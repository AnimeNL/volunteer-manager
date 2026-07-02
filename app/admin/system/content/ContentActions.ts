// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod';

import { Temporal } from '@lib/Temporal';
import { clearContentCacheForEventAndType, writeContentLog } from './ContentDataSource';
import { executeServerAction } from '@lib/serverAction';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { nanoid } from '@lib/nanoid';
import db, { tContent, tContentCategories, tEvents, tUsers } from '@lib/database';

import { kContentType } from '@lib/database/Types';

/**
 * Server action schema for retrieving a single content item.
 */
const kGetContentSchema = z.object({
    id: z.coerce.number(),
    context: z.object({
        eventId: z.coerce.number(),
        teamId: z.coerce.number(),
        type: z.enum(kContentType),
    }),
});

/**
 * Server action to retrieve a single content item.
 */
export async function getContent(formData: z.infer<typeof kGetContentSchema>) {
    return executeServerAction(formData, kGetContentSchema, async (data, props) => {
        const { id, context } = data;

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
                protected: tContent.contentProtected.equals(1),
            })
            .executeSelectNoneOrOne();

        if (!row) {
            return {
                success: false,
                error: 'This item could not be retrieved from the database.',
            };
        }

        return {
            success: true,
            row,
        };
    });
}

/**
 * Server action schema for creating a new content item.
 */
const kCreateContentSchema = z.object({
    context: z.object({
        eventId: z.coerce.number(),
        teamId: z.coerce.number(),
        type: z.enum(kContentType),
    }),
    row: z.object({
        path: z.string().optional().nullable(),
        title: z.string().min(1),
        categoryId: z.coerce.number().optional().nullable(),
    }),
});

/**
 * Server action to create a new content item.
 */
export async function createContent(formData: z.infer<typeof kCreateContentSchema>) {
    return executeServerAction(formData, kCreateContentSchema, async (data, props) => {
        const { context, row } = data;

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

        let contentPath = row.path || '';
        if (!contentPath && context.type === 'FAQ')
            contentPath = nanoid(8);

        if (!contentPath || !row.title)
            return { success: false, error: 'The content title and path must be included' };

        const existingContent = await db.selectFrom(tContent)
            .where(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
                .and(tContent.contentPath.equals(contentPath))
                .and(tContent.revisionVisible.equals(1))
            .selectCountAll()
            .executeSelectOne();

        if (!!existingContent)
            return { success: false, error: 'There already exists a page with that path' };

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tContent)
            .set({
                eventId: context.eventId,
                teamId: context.teamId,
                contentPath: contentPath,
                contentCategoryId: row.categoryId ?? undefined,
                contentTitle: row.title,
                contentType: context.type,
                contentProtected: 0,
                content: '',
                revisionAuthorId: props.user!.id,
                revisionDate: dbInstance.currentZonedDateTime(),
                revisionVisible: 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        await writeContentLog(insertId, 'created', props.user!);
        clearContentCacheForEventAndType(context.eventId, context.type);

        return {
            success: true,
            row: {
                id: insertId,
                path: contentPath,
                title: row.title,
                updatedOn: Temporal.Now.zonedDateTimeISO('UTC').toString(),
                updatedBy: `${props.user!.firstName} ${props.user!.lastName}`,
                updatedByUserId: props.user!.id,
                protected: false,
            },
        };
    });
}

/**
 * Server action schema for updating an existing content item.
 */
const kUpdateContentSchema = z.object({
    id: z.coerce.number(),
    context: z.object({
        eventId: z.coerce.number(),
        teamId: z.coerce.number(),
        type: z.enum(kContentType),
    }),
    row: z.object({
        id: z.coerce.number(),
        content: z.string().optional(),
        path: z.string().optional(),
        categoryId: z.coerce.number().optional().nullable(),
        title: z.string(),
    }),
});

/**
 * Server action to update an existing content item.
 */
export async function updateContent(formData: z.infer<typeof kUpdateContentSchema>) {
    return executeServerAction(formData, kUpdateContentSchema, async (data, props) => {
        const { id, context, row } = data;

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

        const existingContent = await db.selectFrom(tContent)
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
            .select({
                path: tContent.contentPath,
                protected: tContent.contentProtected.equals(1)
            })
            .executeSelectOne();

        const contentPath = row.path ?? existingContent.path;

        if (existingContent.path !== contentPath) {
            if (existingContent.protected)
                return { success: false, error: 'You cannot change the path of protected content' };

            const duplicatedContent = await db.selectFrom(tContent)
                .where(tContent.eventId.equals(context.eventId))
                    .and(tContent.teamId.equals(context.teamId))
                    .and(tContent.contentType.equals(context.type))
                    .and(tContent.contentPath.equals(contentPath))
                    .and(tContent.revisionVisible.equals(1))
                .select({ id: tContent.contentId })
                .executeSelectNoneOrOne();

            if (duplicatedContent && duplicatedContent.id !== id)
                return { success: false, error: 'There already exists a page with that path' };
        }

        const affectedRows = await db.update(tContent)
            .set({
                contentPath: contentPath,
                contentCategoryId: row.categoryId ?? undefined,
                contentTitle: row.title,
                content: row.content ?? '',
                revisionAuthorId: props.user!.id,
                revisionDate: db.currentZonedDateTime(),
            })
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(context.eventId))
                .and(tContent.teamId.equals(context.teamId))
                .and(tContent.contentType.equals(context.type))
            .executeUpdate();

        if (affectedRows) {
            await writeContentLog(id, 'updated', props.user!);
            clearContentCacheForEventAndType(context.eventId, context.type);
        }

        return { success: !!affectedRows };
    });
}
