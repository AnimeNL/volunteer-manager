// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import EuroIcon from '@mui/icons-material/Euro';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { CategoryCell, PriceCell } from './SettingsCells';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { FinanceProcessor } from '../FinanceProcessor';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEventsSalesConfiguration } from '@lib/database';

import { kEventSaleCategoryOptions } from './SettingsCells';
import { kEventSalesCategory } from '@lib/database/Types';
import { kEventTransformer } from '@app/admin/components/DataTable';

/**
 * Data source for the financial settings of an event.
 */
const eventFinanceDataSource = createDataSource('admin/event/finance/settings', withContext({
    /**
     * Event for which financial settings are being configured.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the sale as it exists in the database.
     */
    id: z.number(),

    /**
     * Type of sale that this row model details.
     */
    product: z.string(),

    /**
     * Category of sale that this row model details.
     */
    category: z.enum(kEventSalesCategory).or(z.literal('null')).nullish(),

    /**
     * Maximum number of sales that can be supported for this particular category.
     */
    categoryLimit: z.number().nullish(),

    /**
     * Description of the product, when known.
     */
    description: z.string().nullish(),

    /**
     * Price of the product, when known.
     */
    price: z.number().nullish(),

    /**
     * Optional event ID that this product is associated with.
     */
    eventId: z.number().nullish(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.settings',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        const dbInstance = db;
        const results = await dbInstance.selectFrom(tEventsSalesConfiguration)
            .where(tEventsSalesConfiguration.eventId.equals(context.event.id))
                .and(tEventsSalesConfiguration.saleProduct.containsInsensitiveIfValue(params.search))
            .select({
                id: tEventsSalesConfiguration.saleId,
                product: tEventsSalesConfiguration.saleProduct,
                category: tEventsSalesConfiguration.saleCategory,
                categoryLimit: tEventsSalesConfiguration.saleCategoryLimit,
                description: tEventsSalesConfiguration.saleDescription,
                price: tEventsSalesConfiguration.salePrice,
                eventId: tEventsSalesConfiguration.saleEventId,
            })
            .orderBy(params.sort.field ?? 'product', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: results.count,
            rows: results.data,
        };
    },

    async update(row, previousRow, props, context) {
        const saleCategory =
            (row.category === 'null' || !row.category) ? null : row.category;

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tEventsSalesConfiguration)
            .set({
                saleCategory,
                saleCategoryLimit: row.categoryLimit || null,
                saleDescription: row.description || null,
                salePrice: row.price ?? null,
                saleEventId: row.eventId || null,
            })
            .where(tEventsSalesConfiguration.eventId.equals(context.event.id))
                .and(tEventsSalesConfiguration.saleId.equals(row.id))
            .executeUpdate();

        if (!!affectedRows)
            await FinanceProcessor.revalidateForEvent(context.event.slug);

        LogBuilder.for('UpdateEventProductAssociation')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                product: row.product,
            });

        return !!affectedRows;
    },
});

/**
 * The <FinanceSettingsPage> component represents the settings related to the financial information
 * of a particular event, such as ticket prices and event associations.
 */
export default async function FinanceSettingsPage(
    props: PageProps<'/admin/events/[event]/finance/settings'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.settings');

    const columns: Column<ExtractRowModel<typeof eventFinanceDataSource>>[] = [
        {
            field: 'product',
            headerName: 'Product',
            editable: false,
            sortable: true,
            flex: 2,
        },
        {
            field: 'price',
            headerName: 'Price',
            editable: false,
            sortable: true,
            type: 'number',
            flex: 1,

            template: 'component',
            templateProps: {
                component: PriceCell,
            },
        },
        {
            field: 'category',
            headerName: 'Category',
            editable: true,
            sortable: true,
            type: 'singleSelect',
            valueOptions: [
                { value: 'null', label: 'Uncategorised' },
                ...Object.entries(kEventSaleCategoryOptions).map(([ value, label ]) =>
                    ({ value, label })),
            ],
            flex: 1,

            template: 'component',
            templateProps: {
                component: CategoryCell,
            },
        },
        {
            field: 'eventId',
            headerName: 'Event ID',
            editable: true,
            sortable: true,
            type: 'number',
            flex: 1,
        },
        {
            field: 'categoryLimit',
            headerName: 'Maximum sales',
            editable: false,
            sortable: true,
            type: 'number',
            flex: 1,
        },
    ];

    return (
        <>
            <Section icon={ <EuroIcon color="primary" /> } title="Financial settings"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Finances', href: `/admin/events/${event.slug}/finance` },
                         { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Program associations for imported {event.shortName} ticket information.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable columns={columns} source={eventFinanceDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'product', sort: 'asc' }}
                           subject="product"
                           disableFooter
                           pageSize={100}
                           listViewProps={{
                               primaryField: 'product',
                               secondaryTemplate: '€{price} · {category}',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', 'Finances', { event: 'event' });
