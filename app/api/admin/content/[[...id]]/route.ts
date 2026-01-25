// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { Temporal } from '@lib/Temporal';
import { clearContentCache } from '@lib/Content';
import { createDataTableApi, type DataTableEndpoints } from '../../../createDataTableApi';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventSlugForId } from '@lib/EventLoader';
import db, { tContent, tContentCategories, tEvents, tTeams, tUsers } from '@lib/database';

import { kContentType } from '@lib/database/Types';

/**
 * Row model for a piece of content, as can be shown or edited through the administration panel.
 */
const kContentRowModel = z.object({
    /**
     * Unique ID of the content as it exists in the database.
     */
    id: z.number(),

    /**
     * The content, using Markdown, contained on the page.
     */
    content: z.string().optional(),

    /**
     * Length of the content, in bytes. Only included in the `list` request.
     */
    contentLength: z.number().optional(),

    /**
     * Path of the content, excluding any prefixes (e.g. "privacy").
     */
    path: z.string().regex(/^[/.a-zA-Z0-9-]*$/),

    /**
     * Optional category ID indicating which content category this belongs to.
     */
    categoryId: z.number().optional(),

    /**
     * Optional name of the category that this content belongs to.
     */
    categoryName: z.string().optional(),

    /**
     * Order of the category. Only exposed for ordering reasons (d'oh).
     */
    categoryOrder: z.number().optional(),

    /**
     * Title of the content.
     */
    title: z.string().min(1),

    /**
     * Date and time (in UTC) at which the content was last updated.
     */
    updatedOn: z.string(),

    /**
     * Full name of the volunteer who last updated the content.
     */
    updatedBy: z.string(),

    /**
     * User ID of the volunteer who last updated the content.
     */
    updatedByUserId: z.number(),

    /**
     * Included when the content has been protected and cannot be removed.
     */
    protected: z.boolean(),
});

/**
 * Context required by the Content API. This is considered the content's "scope".
 */
const kContentContext = z.object({
    context: z.object({
        /**
         * Unique ID of the event content will be scoped to.
         */
        eventId: z.coerce.number(),

        /**
         * Unique ID of the team content will be scoped to.
         */
        teamId: z.coerce.number(),

        /**
         * Kind of content that's being requested.
         */
        type: z.enum(kContentType),
    }),
});

/**
 * Export type definitions so that the Content DataTable API can be used in `callApi()`.
 */
export type ContentEndpoints = DataTableEndpoints<typeof kContentRowModel, typeof kContentContext>;

/**
 * Export type definition for the Content DataTable API's Row Model.
 */
export type ContentRowModel = z.infer<typeof kContentRowModel>;

/**
 * Scope expected by the Content API.
 */
export type ContentScope = z.infer<typeof kContentContext>['context'];

/**
 * The Content API is implemented as a regular, editable DataTable API. All operations are gated on
 * permissions specific to the content's context, and changes will be logged as appropriate.
 *
 * The following endpoints are provided by this implementation:
 *
 *     DELETE /api/admin/content/:id
 *     GET /api/admin/content
 *     GET /api/admin/content/:id
 *     POST /api/admin/content
 *     PUT /api/admin/content/:id
 */
export const { DELETE, POST, PUT, GET } = createDataTableApi(kContentRowModel, kContentContext, {
    async accessCheck({ context }, action, props) {
        if (context.eventId === /* invalid event= */ 0) {
            executeAccessCheck(props.authenticationContext, {
                check: 'admin',
                permission: 'system.content',
            });
        } else {
            executeAccessCheck(props.authenticationContext, {
                check: 'admin-event',
                event: (await getEventSlugForId(context.eventId))!,
            })
        }
    },

    async create({ context, row }, props) {
        if (!row.path || !row.title)
            return { success: false, error: 'The content title and path must be included' };

        const existingContent = await db.selectFrom(tContent)
            .where(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
                .and(tContent.contentPath.equals(row.path))
                .and(tContent.revisionVisible.equals(/* true= */ 1))
            .selectCountAll()
            .executeSelectOne();

        if (!!existingContent)
            return { success: false, error: 'There already exists a page with that path' };

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tContent)
            .set({
                eventId: context.eventId,
                teamId: context.teamId,
                contentPath: row.path,
                contentCategoryId: row.categoryId,
                contentTitle: row.title,
                contentType: context.type,
                contentProtected: /* unprotected= */ 0,
                content: '',
                revisionAuthorId: props.user!.id,
                revisionDate: dbInstance.currentZonedDateTime(),
                revisionVisible: /* true= */ 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        clearContentCache();

        return {
            success: true,
            row: {
                id: insertId,
                path: row.path,
                title: row.title,
                updatedOn: Temporal.Now.zonedDateTimeISO('UTC').toString(),
                updatedBy: `${props.user!.firstName} ${props.user!.lastName}`,
                updatedByUserId: props.user!.id,
                protected: false,
            },
        }
    },

    async delete({ context, id }) {
        const affectedRows = await db.update(tContent)
            .set({ revisionVisible: /* false= */ 0 })
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
                .and(tContent.contentProtected.equals(/* false= */ 0))
            .executeUpdate(/* min= */ 0, /* max= */ 1);

        clearContentCache();

        return { success: !!affectedRows };
    },

    async get({ context, id }) {
        const contentCategoriesJoin = tContentCategories.forUseInLeftJoin();

        const dbInstance = db;
        const row = await dbInstance.selectFrom(tContent)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tContent.revisionAuthorId))
            .leftJoin(contentCategoriesJoin)
                .on(contentCategoriesJoin.categoryId.equals(tContent.contentCategoryId))
                    .and(contentCategoriesJoin.categoryDeleted.isNull())
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
            .select({
                id: tContent.contentId,
                content: tContent.content,
                path: tContent.contentPath,
                categoryId: contentCategoriesJoin.categoryId,
                title: tContent.contentTitle,
                updatedOn: dbInstance.dateTimeAsString(tContent.revisionDate),
                updatedBy: tUsers.name,
                updatedByUserId: tUsers.userId,
                protected: tContent.contentProtected.equals(/* true= */ 1),
            })
            .executeSelectNoneOrOne();

        if (!row)
            return { success: false, error: 'This item could not be retrieved from the database.' };

        return { success: true, row };
    },

    async list({ context, pagination, sort }) {
        if (sort?.field === 'content')
            return { success: false, error: 'Unable to sort based on Markdown content' };

        const dbInstance = db;

        const contentCategoriesJoin = tContentCategories.forUseInLeftJoin();

        const { count, data } = await dbInstance.selectFrom(tContent)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tContent.revisionAuthorId))
            .leftJoin(contentCategoriesJoin)
                .on(contentCategoriesJoin.categoryId.equals(tContent.contentCategoryId))
            .where(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
                .and(tContent.revisionVisible.equals(/* true= */ 1))
            .select({
                id: tContent.contentId,
                path: tContent.contentPath,
                contentLength: tContent.content.length(),
                categoryId: contentCategoriesJoin.categoryId,
                categoryName: contentCategoriesJoin.categoryTitle,
                categoryOrder: contentCategoriesJoin.categoryOrder,
                title: tContent.contentTitle,
                updatedOn: dbInstance.dateTimeAsString(tContent.revisionDate),
                updatedBy: tUsers.name,
                updatedByUserId: tUsers.userId,
                protected: tContent.contentProtected.equals(/* true= */ 1),
            })
            .orderBy(sort?.field ?? 'path', sort?.sort ?? 'asc')
                .orderBy('title', 'asc')
            .limitIfValue(pagination ? pagination.pageSize : null)
                .offsetIfValue(pagination ? pagination.page * pagination.pageSize : null)
            .executeSelectPage();

        return {
            success: true,
            rowCount: count,
            rows: data,
        }
    },

    async update({ context, id, row }, props) {
        // (1) Fetch whether the existing content is protected, in which case we do not allow the
        //     path to be updated. Failing to do that check could break the system.
        const existingContent = await db.selectFrom(tContent)
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
            .select({
                path: tContent.contentPath,
                protected: tContent.contentProtected.equals(/* true= */ 1)
            })
            .executeSelectNoneOrOne();

        if (!existingContent)
            return { success: false, error: 'The content you are editing could not be found' };

        if (existingContent.path !== row.path) {
            if (existingContent.protected)
                return { success: false, error: 'You cannot change the path of protected content' };

            // (2) Determine whether there exists any duplicated content, which means multiple
            //     pieces of content within the same scope that share the same path.
            const duplicatedContent = await db.selectFrom(tContent)
                .where(tContent.eventId.equals(context.eventId))
                    .and(tContent.teamId.equals(context.teamId))
                    .and(tContent.contentType.equals(context.type))
                    .and(tContent.contentPath.equals(row.path))
                    .and(tContent.revisionVisible.equals(/* true= */ 1))
                .select({ id: tContent.contentId })
                .executeSelectNoneOrOne();

            if (duplicatedContent && duplicatedContent.id !== id)
                return { success: false, error: 'There already exists a page with that path' }
        }

        // (3) Actually update the content now that we know this can be safely done so.
        const affectedRows = await db.update(tContent)
            .set({
                contentPath: row.path,
                contentCategoryId: row.categoryId,
                contentTitle: row.title,
                content: row.content,
                revisionAuthorId: props.user!.id,
                revisionDate: db.currentZonedDateTime(),
            })
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
            .executeUpdate();

        clearContentCache();

        return { success: !!affectedRows };
    },

    async writeLog({ id }, mutation, props) {
        const eventsJoin = tEvents.forUseInLeftJoin();
        const teamsJoin = tTeams.forUseInLeftJoin();

        const contentContext = await db.selectFrom(tContent)
            .leftJoin(eventsJoin)
                .on(eventsJoin.eventId.equals(tContent.eventId))
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamId.equals(tContent.teamId))
            .where(tContent.contentId.equals(id))
            .select({
                eventName: eventsJoin.eventShortName,
                teamName: teamsJoin.teamName,
                contentTitle: tContent.contentTitle,
                contentType: tContent.contentType,
            })
            .executeSelectNoneOrOne();

        if (contentContext?.contentType === kContentType.FAQ) {
            RecordLog({
                type: kLogType.AdminKnowledgeBaseMutation,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                data: {
                    mutation,
                    event: contentContext.eventName,
                    question: contentContext.contentTitle,
                },
            });

            return;
        }

        let resolvedContext = `with unknown context (id: ${id})`;
        if (contentContext) {
            if (!!contentContext.eventName) {
                resolvedContext =
                    `"${contentContext.contentTitle}" for ${contentContext.eventName} ` +
                    `(${contentContext.teamName})`;
            } else {
                resolvedContext = `"${contentContext.contentTitle}" from global content`;
            }
        }

        RecordLog({
            type: kLogType.AdminContentMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                context: resolvedContext,
                mutation,
            },
        });
    },
});
