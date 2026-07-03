// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod';

import type { ContentScope } from './ContentScope';
import { clearContentCacheForEventAndType, writeContentLog } from './ContentDataSource';
import { executeServerAction } from '@lib/serverAction';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { nanoid } from '@lib/nanoid';
import db, { tContent, tContentCategories, tEvents, tUsers } from '@lib/database';

/**
 * Server action schema for creating a new content item.
 */
const kCreateContentData = z.object({
    path: z.string(),
    title: z.string().min(1),
    categoryId: z.number().optional(),
});

/**
 * Server action to create a new content item.
 */
export async function createContent(scope: ContentScope, row: unknown) {
    return executeServerAction(row, kCreateContentData, async (data, props) => {
        if (scope.eventId === 0) {
            executeAccessCheck(props.authenticationContext, {
                check: 'admin',
                permission: 'system.content',
            });
        } else {
            const eventSlug = await db.selectFrom(tEvents)
                .where(tEvents.eventId.equals(scope.eventId))
                .selectOneColumn(tEvents.eventSlug)
                .executeSelectOne();

            executeAccessCheck(props.authenticationContext, {
                check: 'admin-event',
                event: eventSlug,
            });
        }

        if (!data.path && scope.type === 'FAQ')
            data.path = nanoid(8);

        if (!data.path || !data.title)
            return { success: false, error: 'The content title and path must be included' };

        const existingContent = await db.selectFrom(tContent)
            .where(tContent.eventId.equals(scope.eventId))
                .and(tContent.teamId.equals(scope.teamId))
                .and(tContent.contentType.equals(scope.type))
                .and(tContent.contentPath.equals(data.path))
                .and(tContent.revisionVisible.equals(1))
            .selectCountAll()
            .executeSelectOne();

        if (!!existingContent)
            return { success: false, error: 'There already exists a page with that path' };

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tContent)
            .set({
                eventId: scope.eventId,
                teamId: scope.teamId,
                contentPath: data.path,
                contentCategoryId: data.categoryId ?? undefined,
                contentTitle: data.title,
                contentType: scope.type,
                contentProtected: 0,
                content: '',
                revisionAuthorId: props.user!.id,
                revisionDate: dbInstance.currentZonedDateTime(),
                revisionVisible: 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        await writeContentLog(insertId, 'created', props.user!);
        clearContentCacheForEventAndType(scope.eventId, scope.type);

        return {
            success: true,
            contentId: insertId,
        };
    });
}

/**
 * Server action to retrieve a single content item.
 */
export async function fetchContent(scope: ContentScope, id: number) {
    return executeServerAction({ /* no data */ }, z.object(), async (data, props) => {
        if (scope.eventId === 0) {
            executeAccessCheck(props.authenticationContext, {
                check: 'admin',
                permission: 'system.content',
            });
        } else {
            const eventSlug = await db.selectFrom(tEvents)
                .where(tEvents.eventId.equals(scope.eventId))
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
                .and(tContent.eventId.equals(scope.eventId))
                .and(tContent.teamId.equals(scope.teamId))
                .and(tContent.contentType.equals(scope.type))
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

        return { success: true, row };
    });
}

/**
 * Server action schema for updating an existing content item.
 */
const kUpdateContentData = z.object({
    content: z.string().optional(),
    path: z.string().optional(),
    categoryId: z.coerce.number().optional().nullable(),
    title: z.string(),
});

/**
 * Server action to update an existing content item.
 */
export async function updateContent(scope: ContentScope, id: number, row: unknown) {
    return executeServerAction(row, kUpdateContentData, async (data, props) => {
        if (scope.eventId === 0) {
            executeAccessCheck(props.authenticationContext, {
                check: 'admin',
                permission: 'system.content',
            });
        } else {
            const eventSlug = await db.selectFrom(tEvents)
                .where(tEvents.eventId.equals(scope.eventId))
                .selectOneColumn(tEvents.eventSlug)
                .executeSelectOne();

            executeAccessCheck(props.authenticationContext, {
                check: 'admin-event',
                event: eventSlug,
            });
        }

        const existingContent = await db.selectFrom(tContent)
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(scope.eventId))
                .and(tContent.teamId.equals(scope.teamId))
                .and(tContent.contentType.equals(scope.type))
            .select({
                path: tContent.contentPath,
                protected: tContent.contentProtected.equals(1)
            })
            .executeSelectOne();

        const contentPath = data.path ?? existingContent.path;

        if (existingContent.path !== contentPath) {
            if (existingContent.protected)
                return { success: false, error: 'You cannot change the path of protected content' };

            const duplicatedContent = await db.selectFrom(tContent)
                .where(tContent.eventId.equals(scope.eventId))
                    .and(tContent.teamId.equals(scope.teamId))
                    .and(tContent.contentType.equals(scope.type))
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
                contentCategoryId: data.categoryId ?? undefined,
                contentTitle: data.title,
                content: data.content ?? '',
                revisionAuthorId: props.user!.id,
                revisionDate: db.currentZonedDateTime(),
            })
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(scope.eventId))
                .and(tContent.teamId.equals(scope.teamId))
                .and(tContent.contentType.equals(scope.type))
            .executeUpdate();

        if (affectedRows) {
            await writeContentLog(id, 'updated', props.user!);
            clearContentCacheForEventAndType(scope.eventId, scope.type);
        }

        return { success: !!affectedRows };
    });
}
