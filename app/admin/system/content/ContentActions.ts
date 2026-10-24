// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import type { ContentScope } from './ContentScope';
import { authorizeContentScope, clearContentCacheForEventAndType, writeContentLog }
    from './ContentDataSource';
import { executeServerAction } from '@lib/serverAction';
import { nanoid } from '@lib/nanoid';
import db, { tContent, tContentCategories, tUsers } from '@lib/database';

/**
 * Server action schema for creating a new content item.
 */
const kCreateContentData = z.object({
    path: z.string().optional().default(''),
    title: z.string().min(1),
    categoryId: z.coerce.number().optional(),
});

/**
 * Server action to create a new content item.
 */
export async function createContent(scope: ContentScope, linkPrefix: string, row: unknown) {
    return executeServerAction(row, kCreateContentData, async (data, props) => {
        await authorizeContentScope(props.authenticationContext, scope);

        if (!data.path && scope.type === 'FAQ')
            data.path = nanoid(8);

        if (!data.path || !data.title)
            return { success: false, error: 'The content title and path must be included' };

        const dbInstance = db;
        const existingContent = await dbInstance.selectFrom(tContent)
            .where(tContent.eventId.equals(scope.eventId))
                .and(tContent.teamId.equals(scope.teamId))
                .and(tContent.contentType.equals(scope.type))
                .and(tContent.contentPath.equals(data.path))
                .and(tContent.revisionVisible.equals(1))
            .selectCountAll()
            .executeSelectOne();

        if (!!existingContent)
            return { success: false, error: 'There already exists a page with that path' };

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

        await writeContentLog(insertId, 'Created', props.user!);
        clearContentCacheForEventAndType(scope.eventId, scope.type);

        return {
            success: true,
            redirect: `${linkPrefix}/${insertId}`,
        };
    });
}

/**
 * Server action to retrieve a single content item.
 */
export async function fetchContent(scope: ContentScope, id: number) {
    return executeServerAction({ /* no data */ }, z.object(), async (data, props) => {
        await authorizeContentScope(props.authenticationContext, scope);

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
        await authorizeContentScope(props.authenticationContext, scope);

        const dbInstance = db;
        const existingContent = await dbInstance.selectFrom(tContent)
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

            const duplicatedContent = await dbInstance.selectFrom(tContent)
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

        const affectedRows = await dbInstance.update(tContent)
            .set({
                contentPath: contentPath,
                contentCategoryId: data.categoryId ?? undefined,
                contentTitle: data.title,
                content: data.content ?? '',
                revisionAuthorId: props.user!.id,
                revisionDate: dbInstance.currentZonedDateTime(),
            })
            .where(tContent.contentId.equals(id))
                .and(tContent.eventId.equals(scope.eventId))
                .and(tContent.teamId.equals(scope.teamId))
                .and(tContent.contentType.equals(scope.type))
            .executeUpdate();

        if (affectedRows) {
            await writeContentLog(id, 'Updated', props.user!);
            clearContentCacheForEventAndType(scope.eventId, scope.type);
        }

        return { success: !!affectedRows };
    });
}
