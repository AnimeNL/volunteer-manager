// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
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
import { createTicketService } from '@lib/tickets';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEventsTicketsConfiguration } from '@lib/database';

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
    id: z.number(),

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
     * Price of the ticket, when known.
     */
    price: z.number().nullish(),

    /**
     * Optional activity ID that this product is associated with.
     */
    activityId: z.number().nullish(),

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
        const service = await createTicketService(context.event.id);
        if (!service)
            return notFound();

        const dbInstance = db;

        const types = await service.listTicketTypes();
        const associations = await dbInstance.selectDistinctFrom(tEventsTicketsConfiguration)
            .where(tEventsTicketsConfiguration.eventId.equals(context.event.id))
            .select({
                ticketId: tEventsTicketsConfiguration.eventTicketYtpId,
                ticketCategory: tEventsTicketsConfiguration.eventTicketCategory,
                ticketActivityId: tEventsTicketsConfiguration.eventTicketActivityId,
            })
            .executeSelectMany();

        const associationsMap = new Map(
            associations.map(association => [ association.ticketId, association ]));

        const products = types.map(type => {
            const ticketId = Number(type.id);  // TODO: Weeztix compatibility

            const association = associationsMap.get(ticketId);
            return {
                id: ticketId,
                product: type.name,
                productLimit: type.amount,
                category: association?.ticketCategory,
                categoryLabel: association?.ticketCategory || '(unassigned)',
                price: type.price / 100,
                activityId: association?.ticketActivityId,
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
                    return ((lhs.price ?? 0) - (rhs.price ?? 0)) * direction;

                case 'product':
                    return lhs.product.localeCompare(rhs.product) * direction;

                case 'productLimit':
                    return ((lhs.productLimit ?? 0) - (rhs.productLimit ?? 0)) * direction;
            }

            return 0;
        });

        return {
            rowCount: products.length,
            rows: products.slice(params.page.offset, params.page.offset + params.page.limit),
        };
    },

    async update(row, previousRow, props, context) {
        const eventTicketActivityId = row.activityId;
        const eventTicketCategory =
            (row.category === 'null' || !row.category) ? null : row.category;

        const affectedRows = await db.insertInto(tEventsTicketsConfiguration)
            .set({
                eventId: context.event.id,
                eventTicketYtpId: row.id,
                eventTicketActivityId,
                eventTicketCategory,
            })
            .onConflictDoUpdateSet({
                eventTicketActivityId,
                eventTicketCategory,
            })
            .executeInsert();

        if (!!affectedRows)
            await FinanceProcessor.revalidateForEvent(context.event.slug);

        LogBuilder.for('UpdateEventProductAssociation')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                product: row.product,
            });

        return !!affectedRows ? { ...row, categoryLabel: row.category || '(unassigned)' } : false;
    },
});

/**
 * Page that allows product associations to be established for the given event.
 */
export default async function EventFinanceSettingsPage(
    props: PageProps<'/admin/events/[event]/finance/settings'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.settings');

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
                               secondaryTemplate: '€{price} · {categoryLabel}',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', 'Finances', { event: 'event' });
