// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import type { ExtractRowModel } from '@app/admin/components/DataTable';
import type { User } from '@lib/auth/User';
import { Cache } from '@lib/cache/Cache';
import { type ContentType, kContentType } from '@lib/database/Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tContent, tContentCategories, tEvents, tTeams, tUsers } from '@lib/database';

/**
 * Clears all content caches for the given `eventId` and `type`.
 */
export function clearContentCacheForEventAndType(eventId: number, type: ContentType) {
    if (type === 'FAQ')
        ScheduleCache.clear('knowledge', eventId);

    Cache.getInstance('Content').delete({ eventId });
}

/**
 * Logs a mutation on content.
 */
export async function writeContentLog(id: number, mutation: string, user: User) {
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
            sourceUser: user,
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
        sourceUser: user,
        data: {
            context: resolvedContext,
            mutation,
        },
    });
}

/**
 * Data source used to populate the content management tables.
 */
export const contentDataSource = createDataSource('admin/system/content', withContext({
    /**
     * Unique ID of the event content is scoped to, or 0 for global content.
     */
    eventId: z.number(),

    /**
     * Unique ID of the team content is scoped to.
     */
    teamId: z.number(),

    /**
     * Kind of content that's being requested.
     */
    type: z.enum(kContentType),

}), withRowModel({
    /**
     * Unique ID of the content.
     */
    id: z.number(),

    /**
     * The markdown content itself.
     */
    content: z.string().optional(),

    /**
     * Length of the content in bytes.
     */
    contentLength: z.number().optional(),

    /**
     * Path of the content, excluding prefixes.
     */
    path: z.string(),

    /**
     * Optional category ID.
     */
    categoryId: z.number().optional(),

    /**
     * Optional category name.
     */
    categoryName: z.string().optional(),

    /**
     * Order of the category (for sorting).
     */
    categoryOrder: z.number().optional(),

    /**
     * Title of the content.
     */
    title: z.string(),

    /**
     * Date and time at which the content was last updated.
     */
    updatedOn: z.string(),

    /**
     * Full name of the user who last updated the content.
     */
    updatedBy: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),

    /**
     * Whether the content is protected and cannot be deleted.
     */
    protected: z.boolean(),

}), {
    async authorize(operation, props, context) {
        if (context.eventId === 0) {
            executeAccessCheck(props.authenticationContext, {
                check: 'admin',
                permission: 'system.content',
            });
        } else {
            const eventSlug = await db.selectFrom(tEvents)
                .where(tEvents.eventId.equals(context.eventId))
                .selectOneColumn(tEvents.eventSlug)
                .executeSelectOne();

            executeAccessCheck(props.authenticationContext, {
                check: 'admin-event',
                event: eventSlug,
            });
        }
    },

    async delete(params, props, context) {
        const affectedRows = await db.update(tContent)
            .set({ revisionVisible: 0 })
            .where(tContent.contentId.equals(params.id))
                .and(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
                .and(tContent.contentProtected.equals(0))
            .executeUpdate(/* min= */ 0, /* max= */ 1);

        if (affectedRows) {
            await writeContentLog(params.id, 'deleted', props.authenticationContext.user!);
            clearContentCacheForEventAndType(context.eventId, context.type);
        }

        return !!affectedRows;
    },

    async list(params, props, context) {
        const dbInstance = db;
        const contentCategoriesJoin = tContentCategories.forUseInLeftJoin();

        let sortField: 'path' | 'title' | 'updatedOn' | 'updatedBy.name' | 'categoryOrder';
        switch (params.sort.field) {
            case 'categoryOrder':
            case 'title':
            case 'updatedOn':
                sortField = params.sort.field as 'categoryOrder' | 'title' | 'updatedOn';
                break;

            case 'updatedBy':
                sortField = 'updatedBy.name';
                break;

            default:
                sortField = 'path';
                break;
        }

        const { count, data } = await dbInstance.selectFrom(tContent)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tContent.revisionAuthorId))
            .leftJoin(contentCategoriesJoin)
                .on(contentCategoriesJoin.categoryId.equals(tContent.contentCategoryId))
            .where(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
                .and(tContent.revisionVisible.equals(1))
                .and(tContent.contentPath.containsInsensitiveIfValue(params.search).or(
                     tContent.contentTitle.containsInsensitiveIfValue(params.search)))
            .select({
                id: tContent.contentId,
                path: tContent.contentPath,
                contentLength: tContent.content.length(),
                categoryId: contentCategoriesJoin.categoryId,
                categoryName: contentCategoriesJoin.categoryTitle,
                categoryOrder: contentCategoriesJoin.categoryOrder,
                title: tContent.contentTitle,
                updatedOn: dbInstance.dateTimeAsString(tContent.revisionDate),
                updatedBy: {
                    id: tUsers.userId,
                    name: tUsers.name,
                },
                protected: tContent.contentProtected.equals(1),
            })
            .orderBy(sortField, params.sort.direction)
                .orderBy('title', 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: count,
            rows: data,
        };
    },
});

export type ContentRowModel = ExtractRowModel<typeof contentDataSource>;
