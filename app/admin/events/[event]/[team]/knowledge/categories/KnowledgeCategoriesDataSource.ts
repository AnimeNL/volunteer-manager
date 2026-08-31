// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ExtractRowModel } from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tContent, tContentCategories } from '@lib/database';

import { kAnyTeam } from '@lib/auth/AccessList';
import { kContentType } from '@lib/database/Types';
import { kEventTransformer } from '@app/admin/components/DataTable';

/**
 * Data source used to populate and manage the knowledge base categories table.
 */
export const knowledgeCategoriesDataSource = createDataSource('admin/event/faq-cats', withContext({
    /**
     * Event for which the categories are being obtained.
     */
    event: kEventTransformer,

}), withRowModel({
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
    description: z.string().nullish(),

    /**
     * Roles that content in the category should be restricted to.
     */
    roles: z.string(),

    /**
     * Teams that content in the category should be restricted to.
     */
    teams: z.string(),

    /**
     * Ordering for this category.
     */
    order: z.number(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.visible',
            scope: {
                event: context.event.slug,
                team: kAnyTeam,
            },
        });
    },

    async create(partialRow, props, context) {
        const kDefaultTitle = 'New category';
        const kDefaultIcon = 'HelpOutline';

        const dbInstance = db;
        const highestCategoryOrder = await dbInstance.selectFrom(tContentCategories)
            .where(tContentCategories.eventId.equals(context.event.id))
                .and(tContentCategories.categoryDeleted.isNull())
            .selectOneColumn(tContentCategories.categoryOrder)
            .orderBy(tContentCategories.categoryOrder, 'desc')
            .limit(1)
            .executeSelectNoneOrOne();

        const categoryOrder = (highestCategoryOrder ?? 0) + 1;

        const insertId = await dbInstance.insertInto(tContentCategories)
            .set({
                eventId: context.event.id,
                categoryTitle: partialRow.title || kDefaultTitle,
                categoryIcon: partialRow.icon || kDefaultIcon,
                categoryOrder,
                categoryCreated: dbInstance.currentZonedDateTime(),
                categoryUpdated: dbInstance.currentZonedDateTime(),
            })
            .returningLastInsertedId()
            .executeInsert();

        if (insertId)
            ScheduleCache.clear('knowledge', context.event.id);

        LogBuilder.for('CreateKnowledgeBaseCategory')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                category: partialRow.title || kDefaultTitle,
                event: context.event.shortName,
            });

        return !!insertId;
    },

    async delete(row, props, context) {
        const remainingQuestions = await db.selectFrom(tContent)
            .where(tContent.eventId.equals(context.event.id))
                .and(tContent.contentType.equals(kContentType.FAQ))
                .and(tContent.contentCategoryId.equals(row.id))
                .and(tContent.revisionVisible.equals(1))
            .selectCountAll()
            .executeSelectOne();

        if (remainingQuestions > 0)
            return false;

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tContentCategories)
            .set({
                categoryDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tContentCategories.categoryId.equals(row.id))
                .and(tContentCategories.eventId.equals(context.event.id))
                .and(tContentCategories.categoryDeleted.isNull())
            .executeUpdate();

        if (affectedRows)
            ScheduleCache.clear('knowledge', context.event.id);

        LogBuilder.for('DeleteKnowledgeBaseCategory')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                category: row.title,
                event: context.event.shortName,
            });

        return !!affectedRows;
    },

    async list(params, props, context) {
        const categories = await db.selectFrom(tContentCategories)
            .where(tContentCategories.eventId.equals(context.event.id))
                .and(tContentCategories.categoryDeleted.isNull())
                .and(tContentCategories.categoryTitle.containsInsensitiveIfValue(params.search).or(
                        tContentCategories.categoryDescription.containsInsensitiveIfValue(
                            params.search)))
            .select({
                id: tContentCategories.categoryId,
                icon: tContentCategories.categoryIcon,
                title: tContentCategories.categoryTitle,
                description: tContentCategories.categoryDescription,
                roles: tContentCategories.categoryRoles,
                teams: tContentCategories.categoryTeams,
                order: tContentCategories.categoryOrder,
            })
            .orderBy(params.sort.field ?? 'order', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: categories.count,
            rows: categories.data,
        };
    },

    async update(updatedRow, previousRow, props, context) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tContentCategories)
            .set({
                categoryTitle: updatedRow.title,
                categoryIcon: updatedRow.icon,
                categoryDescription: updatedRow.description || null,
                categoryRoles: updatedRow.roles,
                categoryTeams: updatedRow.teams,
                categoryOrder: updatedRow.order,
                categoryUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tContentCategories.categoryId.equals(updatedRow.id))
                .and(tContentCategories.eventId.equals(context.event.id))
                .and(tContentCategories.categoryDeleted.isNull())
            .executeUpdate();

        if (affectedRows)
            ScheduleCache.clear('knowledge', context.event.id);

        LogBuilder.for('UpdateKnowledgeBaseCategory')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                category: updatedRow.title,
                event: context.event.shortName,
            });

        return !!affectedRows;
    },
});

export type KnowledgeCategoriesRowModel = ExtractRowModel<typeof knowledgeCategoriesDataSource>;
