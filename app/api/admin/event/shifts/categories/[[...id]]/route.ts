// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tShiftsCategories } from '@lib/database';

/**
 * Row model for a shift category, defining how volunteers can be put into action.
 */
const kEventShiftCategoryRowModel = z.object({
    /**
     * Unique ID of the category as it exists in the database.
     */
    id: z.number(),

    /**
     * Name of the category, as it should be presented to volunteering leads.
     */
    name: z.string(),

    /**
     * Base colour that should be assigned to the category. A palette will be generated.
     */
    colour: z.string(),

    /**
     * Base excitement level for this category. Individual shifts may supersede.
     */
    excitement: z.number(),

    /**
     * Whether shifts in this category count towards someone's contribution.
     */
    countContribution: z.boolean(),

    /**
     * Ordering for this category.
     */
    order: z.number(),
});

/**
 * This API has no context requirements.
 */
const kEventShiftCategoryContext = z.never();

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type EventShiftCategoriesEndpoints =
    DataTableEndpoints<typeof kEventShiftCategoryRowModel, typeof kEventShiftCategoryContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type EventShiftCategoriesRowModel = z.infer<typeof kEventShiftCategoryRowModel>;

/**
 * This is implemented as a regular DataTable API. The following endpoints are provided by this
 * implementation:
 *
 *     GET    /api/admin/event/shifts/categories
 *     DELETE /api/admin/event/shifts/categories/:id
 *     POST   /api/admin/event/shifts/categories
 *     PUT    /api/admin/event/shifts/categories/:id
 */
export const { GET, DELETE, POST, PUT } =
createDataTableApi(kEventShiftCategoryRowModel, kEventShiftCategoryContext, {
    async accessCheck(request, action, props) {
        executeAccessCheck(props.authenticationContext, 'event.shift-categories');
    },

    async create() {
        const kCategoryName = 'New category';
        const kCategoryColour = '#ff5722';
        const kCategoryExcitement = 0.5;

        const insertId = await db.insertInto(tShiftsCategories)
            .set({
                shiftCategoryName: kCategoryName,
                shiftCategoryColour: kCategoryColour,
                shiftCategoryExcitement: 0.5,
                shiftCategoryCountContribution: /* true= */ 1,
                shiftCategoryOrder: 0,
            })
            .returningLastInsertedId()
            .executeInsert();

        return {
            success: true,
            row: {
                id: insertId,
                name: kCategoryName,
                colour: kCategoryColour,
                excitement: kCategoryExcitement,
                countContribution: true,
                order: 0,
            },
        };
    },

    async delete({ id }) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tShiftsCategories)
            .set({
                shiftCategoryDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tShiftsCategories.shiftCategoryId.equals(id))
                .and(tShiftsCategories.shiftCategoryDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async list({ sort }) {
        const results = await db.selectFrom(tShiftsCategories)
            .where(tShiftsCategories.shiftCategoryDeleted.isNull())
            .select({
                id: tShiftsCategories.shiftCategoryId,
                name: tShiftsCategories.shiftCategoryName,
                colour: tShiftsCategories.shiftCategoryColour,
                excitement: tShiftsCategories.shiftCategoryExcitement,
                countContribution:
                    tShiftsCategories.shiftCategoryCountContribution.equals(/* true= */ 1),
                order: tShiftsCategories.shiftCategoryOrder,
            })
            .orderBy(sort?.field ?? 'order', sort?.sort ?? 'asc')
            .executeSelectMany();

        return {
            success: true,
            rowCount: results.length,
            rows: results,
        };
    },

    async reorder({ order }) {
        const dbInstance = db;
        await dbInstance.transaction(async () => {
            for (let index = 0; index < order.length; ++index) {
                await db.update(tShiftsCategories)
                    .set({ shiftCategoryOrder: index })
                    .where(tShiftsCategories.shiftCategoryId.equals(order[index]))
                    .executeUpdate();
            }
        });

        return { success: true };
    },

    async update({ row }) {
        const affectedRows = await db.update(tShiftsCategories)
            .set({
                shiftCategoryName: row.name,
                shiftCategoryColour: row.colour,
                shiftCategoryExcitement: row.excitement,
                shiftCategoryCountContribution: row.countContribution ? 1 : 0,
            })
            .where(tShiftsCategories.shiftCategoryId.equals(row.id))
                .and(tShiftsCategories.shiftCategoryDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async writeLog({ id }, mutation, props) {
        if (mutation === 'Reordered')
            return;  // no need to log when someone changes the order of categories

        const shiftCategoryName = await db.selectFrom(tShiftsCategories)
            .where(tShiftsCategories.shiftCategoryId.equals(id))
            .selectOneColumn(tShiftsCategories.shiftCategoryName)
            .executeSelectNoneOrOne();

        RecordLog({
            type: kLogType.AdminEventShiftCategoryMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                category: shiftCategoryName,
                mutation,
            },
        });
    },
});
