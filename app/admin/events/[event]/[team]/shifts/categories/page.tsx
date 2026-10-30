// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import CategoryIcon from '@mui/icons-material/Category';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { ColourRangeCell } from './ShiftCategoryCells';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { ExcitementCell, ExcitementHeader } from '../ShiftCells';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tShifts, tShiftsCategories } from '@lib/database';

import { kExcitementOptions } from '@app/admin/components/ExcitementIcon';

/**
 * Data source used to populate and manage the shift categories table.
 */
const shiftCategoriesDataSource = createDataSource('admin/event/shift-categories', withRowModel({
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

    /**
     * Whether this category is protected and cannot be deleted.
     */
    protected: z.boolean(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, 'event.shift-categories');
    },

    async create(partialRow, props) {
        if (!partialRow.name || !partialRow.colour || !partialRow.excitement)
            return false;

        const countContribution = partialRow.countContribution ?? false;

        const dbInstance = db;
        const highestOrder = await dbInstance.selectFrom(tShiftsCategories)
            .where(tShiftsCategories.shiftCategoryDeleted.isNull())
            .selectOneColumn(tShiftsCategories.shiftCategoryOrder)
            .orderBy(tShiftsCategories.shiftCategoryOrder, 'desc')
            .limit(1)
            .executeSelectNoneOrOne();

        const order = (highestOrder ?? 0) + 1;

        const insertId = await dbInstance.insertInto(tShiftsCategories)
            .set({
                shiftCategoryName: partialRow.name,
                shiftCategoryColour: partialRow.colour,
                shiftCategoryExcitement: partialRow.excitement,
                shiftCategoryCountContribution: countContribution ? 1 : 0,
                shiftCategoryOrder: order,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateShiftCategory')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                category: partialRow.name,
            });

        return !!insertId;
    },

    async delete(row, props) {
        if (row.id === 1)
            return false;

        const dbInstance = db;
        const remainingShifts = await dbInstance.selectFrom(tShifts)
            .where(tShifts.shiftCategoryId.equals(row.id))
                .and(tShifts.shiftDeleted.isNull())
            .selectCountAll()
            .executeSelectOne();

        if (remainingShifts > 0)
            return false;

        const affectedRows = await dbInstance.update(tShiftsCategories)
            .set({
                shiftCategoryDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tShiftsCategories.shiftCategoryId.equals(row.id))
                .and(tShiftsCategories.shiftCategoryDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('DeleteShiftCategory')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                category: row.name,
            });

        return !!affectedRows;
    },

    async list(params) {
        const categories = await db.selectFrom(tShiftsCategories)
            .where(tShiftsCategories.shiftCategoryDeleted.isNull())
                .and(tShiftsCategories.shiftCategoryName.containsInsensitiveIfValue(params.search))
            .select({
                id: tShiftsCategories.shiftCategoryId,
                name: tShiftsCategories.shiftCategoryName,
                colour: tShiftsCategories.shiftCategoryColour,
                excitement: tShiftsCategories.shiftCategoryExcitement,
                countContribution:
                    tShiftsCategories.shiftCategoryCountContribution.equals(/* true= */ 1),
                order: tShiftsCategories.shiftCategoryOrder,
            })
            .orderBy('order', 'asc')
            .executeSelectMany();

        return {
            rowCount: categories.length,
            rows: categories.map(category => ({
                ...category,
                protected: category.id === 1,
            })),
        };
    },

    async reorder(order) {
        const dbInstance = db;
        await dbInstance.transaction(async () => {
            for (let index = 0; index < order.length; ++index) {
                await dbInstance.update(tShiftsCategories)
                    .set({ shiftCategoryOrder: index })
                    .where(tShiftsCategories.shiftCategoryId.equals(order[index]))
                        .and(tShiftsCategories.shiftCategoryDeleted.isNull())
                    .executeUpdate();
            }
        });

        return true;
    },

    async update(updatedRow, previousRow, props) {
        const affectedRows = await db.update(tShiftsCategories)
            .set({
                shiftCategoryName: updatedRow.name,
                shiftCategoryColour: updatedRow.colour,
                shiftCategoryExcitement: updatedRow.excitement,
                shiftCategoryCountContribution: updatedRow.countContribution ? 1 : 0,
            })
            .where(tShiftsCategories.shiftCategoryId.equals(updatedRow.id))
                .and(tShiftsCategories.shiftCategoryDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateShiftCategory')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                category: updatedRow.name,
            });

        return !!affectedRows;
    },
});

/**
 * The shift categories page allows administrators to modify the categories in which shifts can be
 * created. The category defines the shift's colour—chromatic colours can be calculated.
 */
export default async function EventTeamShiftCategoriesPage(
    props: PageProps<'/admin/events/[event]/[team]/shifts/categories'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.shift-categories',
    });

    const columns: Column<ExtractRowModel<typeof shiftCategoriesDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Category',
            editable: true,
            flex: 1,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'colour',
            headerName: 'Colour',
            description: 'Colours that will be assigned to shifts',
            editable: true,
            flex: 1,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: ColourRangeCell,
            },
        },
        {
            field: 'excitement',
            display: 'flex',
            headerAlign: 'center',
            headerName: 'Default excitement',
            align: 'center',
            editable: true,
            sortable: false,
            width: 50,

            type: 'singleSelect',
            valueOptions: kExcitementOptions,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: ExcitementCell,
                headerComponent: ExcitementHeader,
            },
        },
        {
            field: 'countContribution',
            description: 'Consider this a contribution?',
            editable: true,
            sortable: false,
            type: 'boolean',

            template: 'boolean',
            templateProps: {
                tooltips: {
                    header: 'Will shifts count as contributions?',
                    falsyValue: 'Shifts do not count as contributions',
                    truthyValue: 'Shifts count as contributions',
                },
            },
        },
    ];

    return (
        <>
            <Section icon={ <CategoryIcon color="primary" /> } title="Shift categories"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Shifts',
                             href: `/admin/events/${event.slug}/${team.slug}/shifts`,
                         },
                         { label: 'Categories' },
                     ]}>
                <SectionIntroduction important>
                    Shift categories are shared across all events and teams, they define the visual
                    identity of each shift.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable columns={columns} source={shiftCategoriesDataSource}
                           defaultSort={{ field: 'order', sort: 'asc' }}
                           pageSize={50} disableFooter subject="category"
                           protectedColumn="protected"
                           listViewProps={{
                               primaryField: 'name',
                               startComponent: ColourRangeCell,
                               endComponent: ExcitementCell,
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Shift categories', 'Shifts', { team: 'team' }, { event: 'event' });
