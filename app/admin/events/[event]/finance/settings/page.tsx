// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import EuroIcon from '@mui/icons-material/Euro';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { CategoryCell } from './SettingsCells';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { FinanceProcessor } from '../FinanceProcessor';
import { LogBuilder } from '@lib/log';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { and, requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { formatTicketPrice } from '@lib/tickets/TicketHelpers';

import { kEventTicketCategory } from '@lib/database/Types';
import { kEventTicketCategoryOptions } from './Settings';
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
     * Unique ID of the ticket type as it exists in the database.
     */
    id: z.string().or(z.number()),

    /**
     * Type of ticket type that this row model details.
     */
    product: z.string(),

    /**
     * Maximum number of tickets that can be supported for this particular category.
     */
    productLimit: z.number().nullish(),

    /**
     * Category of tickets that this row model details.
     */
    category: z.enum(kEventTicketCategory).or(z.literal('')).or(z.literal('null')).nullish(),

    /**
     * Label to assign to the category of tickets that the row model details.
     */
    categoryLabel: z.string().nullish(),

    /**
     * Price of the ticket, formatted in euros.
     */
    price: z.string(),

    /**
     * Optional activity ID that this product is associated with.
     */
    activityId: z.number().nullish(),

}), {
    async authorize(operation, props, context) {
        await requireAuthenticationWithEvent(
            props.authenticationContext, context.event.slug,
            and('statistics.finances', 'event.settings'));
    },

    async list(params, props, context) {
        const service = await createTicketService(context.event.id);
        if (!service)
            notFound();

        const types = await service.listTicketTypes();
        const configurations = await service.listTicketConfigurations(context.event.id);
        const associationsMap = new Map(
            configurations.map(config => [ config.ticketTypeId, config ]));

        const products = types.map(type => {
            const association = associationsMap.get(type.id);
            return {
                id: type.id,
                product: type.name,
                productLimit: type.amount,
                category: association?.category ?? ('' as const),
                categoryLabel: association?.category || '(unassigned)',
                price: type.price,
                activityId: association?.activityId,
            };
        });

        products.sort((lhs, rhs) => {
            const direction = params.sort.direction === 'asc' ? 1 : -1;
            switch (params.sort.field) {
                case 'activityId':
                    return ((lhs.activityId ?? 0) - (rhs.activityId ?? 0)) * direction;

                case 'category':
                    return (lhs.category ?? '').localeCompare(rhs.category ?? '') * direction;

                case 'price':
                    return (lhs.price - rhs.price) * direction;

                case 'product':
                    return lhs.product.localeCompare(rhs.product) * direction;

                case 'productLimit':
                    return ((lhs.productLimit ?? 0) - (rhs.productLimit ?? 0)) * direction;
            }

            return 0;
        });

        const paginated = products.slice(
            params.page.offset, params.page.offset + params.page.limit);

        return {
            rowCount: products.length,
            rows: paginated.map(product => ({
                ...product,
                price: formatTicketPrice(product.price),
            })),
        };
    },

    async update(row, previousRow, props, context) {
        const service = await createTicketService(context.event.id);
        if (!service)
            notFound();

        const normaliseCategory = (value: typeof row.category) =>
            (value === 'null' || !value) ? null : value;

        const eventTicketActivityId = row.activityId ?? null;
        const eventTicketCategory = normaliseCategory(row.category);

        const categoryLabel = eventTicketCategory || '(unassigned)';
        if (eventTicketActivityId === (previousRow.activityId ?? null) &&
                eventTicketCategory === normaliseCategory(previousRow.category)) {
            return { ...row, categoryLabel };
        }

        const updated = await service.upsertTicketConfiguration(context.event.id, row.id, {
            activityId: eventTicketActivityId,
            category: eventTicketCategory,
        });

        if (!updated)
            return false;

        await FinanceProcessor.revalidateForEvent(context.event.slug);

        LogBuilder.for('UpdateEventProductAssociation')
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                product: row.product,
            });

        return { ...row, categoryLabel };
    },
});

/**
 * Page that allows product associations to be established for the given event.
 */
export default async function EventFinanceSettingsPage(
    props: PageProps<'/admin/events/[event]/finance/settings'>)
{
    const { event } = await requireAuthenticationWithEvent(
        props, and('statistics.finances', 'event.settings'));

    const service = await createTicketService(event.id);
    if (!service)
        notFound();

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
            headerAlign: 'right',
            headerName: 'Price',
            align: 'right',
            editable: false,
            sortable: true,
            flex: 1,
        },
        {
            field: 'category',
            headerName: 'Category',
            editable: true,
            sortable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: [
                { value: '', label: 'Uncategorised' },
                ...Object.entries(kEventTicketCategoryOptions).map(([ value, label ]) =>
                    ({ value, label })),
            ],

            template: 'component',
            templateProps: {
                component: CategoryCell,
            },
        },
        {
            field: 'activityId',
            headerName: 'Activity ID',
            editable: true,
            sortable: true,
            type: 'number',
            flex: 1,

            template: 'number',
            templateProps: {},
        },
        {
            field: 'productLimit',
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
                           subject="product" disableSearch
                           pageSize={100}
                           listViewProps={{
                               primaryField: 'product',
                               secondaryTemplate: '{price} · {categoryLabel}',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', 'Finances', { event: 'event' });
