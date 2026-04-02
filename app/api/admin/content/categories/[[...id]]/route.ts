// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tContentCategories, tContent } from '@lib/database';

import { kContentType } from '@lib/database/Types';

/**
 * Row model for a content category.
 */
const kContentCategoryRowModel = z.object({
    /**
     * Unique ID of the category as it exists in the database.
     */
    id: z.number(),

    /**
     * Identifier for the icon that should be used for this category.
     */
    icon: z.string(),

    /**
     * Title of the category.
     */
    title: z.string(),

    /**
     * Description for the category.
     */
    description: z.string().optional(),

    /**
     * Roles that content in the category should be restricted to.
     *
     * @todo Update to an array of numbers
     */
    roles: z.string(),

    /**
     * Teams that content in the category should be restricted to.
     *
     * @todo Update to an array of numbers
     */
    teams: z.string(),

    /**
     * Ordering for this category.
     */
    order: z.number(),
});

/**
 * This API is associated with a particular event.
 */
const kContentCategoryContext = z.object({
    context: z.object({
        /**
         * Unique slug of the event that the category is in scope of.
         */
        event: z.string(),
    }),
});

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type ContentCategoriesEndpoints =
    DataTableEndpoints<typeof kContentCategoryRowModel, typeof kContentCategoryContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type ContentCategoriesRowModel = z.infer<typeof kContentCategoryRowModel>;

/**
 * This is implemented as a regular DataTable API. The following endpoints are provided by this
 * implementation:
 *
 *     GET    /api/admin/content/categories
 *     DELETE /api/admin/content/categories/:id
 *     POST   /api/admin/content/categories
 *     PUT    /api/admin/content/categories/:id
 */
export const { GET, DELETE, POST, PUT } =
createDataTableApi(kContentCategoryRowModel, kContentCategoryContext, {
    async accessCheck({ context }, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event,
        });
    },

    async create({ context }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !props.user)
            notFound();

        const kDefaultTitle = 'New category';
        const kDefaultIcon = 'Unknown';

        const dbInstance = db;
        const highestCategoryOrder = await dbInstance.selectFrom(tContentCategories)
            .where(tContentCategories.eventId.equals(event.id))
                .and(tContentCategories.categoryDeleted.isNull())
            .selectOneColumn(tContentCategories.categoryOrder)
            .orderBy(tContentCategories.categoryOrder, 'desc')
            .limit(1)
            .executeSelectNoneOrOne();

        const categoryOrder = (highestCategoryOrder ?? 0) + 1;

        const insertId = await dbInstance.insertInto(tContentCategories)
            .set({
                eventId: event.id,
                categoryTitle: kDefaultTitle,
                categoryIcon: kDefaultIcon,
                categoryOrder,
                categoryCreated: dbInstance.currentZonedDateTime(),
                categoryUpdated: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return {
            success: true,
            row: {
                id: insertId,
                icon: kDefaultIcon,
                title: kDefaultTitle,
                roles: /* no restrictions= */ '',
                teams: /* no restrictions= */ '',
                order: categoryOrder,
            },
        };
    },

    async delete({ context, id }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const remainingQuestions = await db.selectFrom(tContent)
            .where(tContent.eventId.equals(event.id))
                .and(tContent.contentType.equals(kContentType.FAQ))
                .and(tContent.contentCategoryId.equals(id))
                .and(tContent.revisionVisible.equals(/* true= */ 1))
            .selectCountAll()
            .executeSelectOne();

        if (remainingQuestions > 0)
            return { success: false, error: 'Unable to remove categories that contain questions' };

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tContentCategories)
            .set({
                categoryDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tContentCategories.categoryId.equals(id))
                .and(tContentCategories.eventId.equals(event.id))
                .and(tContentCategories.categoryDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async list({ context, sort }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const categories = await db.selectFrom(tContentCategories)
            .where(tContentCategories.eventId.equals(event.id))
                .and(tContentCategories.categoryDeleted.isNull())
            .select({
                id: tContentCategories.categoryId,
                icon: tContentCategories.categoryIcon,
                title: tContentCategories.categoryTitle,
                description: tContentCategories.categoryDescription,
                roles: tContentCategories.categoryRoles,
                teams: tContentCategories.categoryTeams,
                order: tContentCategories.categoryOrder,
            })
            .orderBy(sort?.field ?? 'title', sort?.sort ?? 'asc')
            .executeSelectPage();

        return {
            success: true,
            rowCount: categories.count,
            rows: categories.data,
        };
    },

    async reorder({ context, order }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        await dbInstance.transaction(async () => {
            for (let index = 0; index < order.length; ++index) {
                await db.update(tContentCategories)
                    .set({ categoryOrder: index })
                    .where(tContentCategories.categoryId.equals(order[index]))
                    .executeUpdate();
            }
        });

        return { success: true };
    },

    async update({ context, row }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tContentCategories)
            .set({
                categoryTitle: row.title,
                categoryIcon: row.icon,
                categoryDescription: !!row.description ? row.description : null,
                categoryRoles: row.roles,
                categoryTeams: row.teams,
                categoryUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tContentCategories.categoryId.equals(row.id))
                .and(tContentCategories.eventId.equals(event.id))
                .and(tContentCategories.categoryDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async writeLog({ context, id }, mutation, props) {
        const event = await getEventBySlug(context.event);
        if (!event || mutation === 'Reordered')
            return;

        const category = await db.selectFrom(tContentCategories)
            .where(tContentCategories.eventId.equals(event.id))
                .and(tContentCategories.categoryId.equals(id))
            .selectOneColumn(tContentCategories.categoryTitle)
            .executeSelectNoneOrOne();

        RecordLog({
            type: kLogType.AdminKnowledgeBaseCategoryMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: event!.shortName,
                category,
                mutation,
            },
        });
    },
});
