// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import PaidIcon from '@mui/icons-material/Paid';

import type { Column } from '@app/admin/components/DataTable';
import type { HotelPaymentRowModel } from './HotelPaymentsDataSource';
import { DataTable } from '@app/admin/components/DataTable';
import { HotelPaymentAmountCell, HotelPaymentConfirmedCell, HotelPaymentConfirmedHeader,
    HotelPaymentGuestCell } from './HotelPaymentCells';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { paymentsDataSource } from './HotelPaymentsDataSource';
import { requireAuthenticationWithEvent } from '@lib/auth';

import { kHotelPaymentResponsible } from '@lib/database/Types';

/**
 * The <EventHotelPaymentsPage> page allows event administrators to track payments for all people in
 * confirmed hotel room bookings for a particular event.
 */
export default async function EventHotelPaymentsPage(
    props: PageProps<'/admin/events/[event]/hotels/payments'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.hotels');
    if (!event.flags.enableHotel)
        notFound();

    const columns: Column<HotelPaymentRowModel>[] = [
        {
            field: 'name',
            headerName: 'Guest',
            editable: false,
            sortable: false,
            flex: 2,

            template: 'component',
            templateProps: {
                component: HotelPaymentGuestCell,
                componentContext: {
                    event: event.slug,
                },
            },
        },
        {
            field: 'checkIn',
            headerName: 'Check in',
            editable: false,
            sortable: false,
            width: 135,

            template: 'date',
        },
        {
            field: 'checkOut',
            headerName: 'Check out',
            editable: false,
            sortable: false,
            width: 135,

            template: 'date',
        },
        {
            field: 'amount',
            headerName: 'Amount',
            description: 'Amount (in cents)',
            editable: true,
            sortable: false,
            type: 'number',
            flex: 1,

            template: 'component',
            templateProps: {
                component: HotelPaymentAmountCell,
            },
        },
        {
            field: 'responsible',
            headerName: 'Paid by',
            editable: true,
            sortable: false,
            flex: 1,

            type: 'singleSelect',
            valueOptions: [
                { value: '', label: 'Unassigned' },
                ...Object.values(kHotelPaymentResponsible).map(value => ({ value, label: value })),
            ],

            template: 'text',
            templateProps: {
                defaultValue: 'Unassigned',
            },
        },
        {
            field: 'confirmed',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            description: 'Has the payment been received?',
            editable: true,
            sortable: false,
            width: 50,

            type: 'boolean',

            template: 'component',
            templateProps: {
                component: HotelPaymentConfirmedCell,
                headerComponent: HotelPaymentConfirmedHeader,
            },
        },
    ];

    return (
        <>
            <Section icon={ <PaidIcon color="primary" /> } title="Hotel payments"
                     documentation="event/hotels"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Hotels', href: `/admin/events/${event.slug}/hotels` },
                         { label: 'Payments' },
                     ]}>
                <SectionIntroduction>
                    Payment tracking for guests staying in confirmed hotel bookings for{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={paymentsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           disableFooter disableSearch pageSize={100} subject="hotel payment"
                           listViewProps={{
                               primaryField: 'name',
                               secondaryTemplate: '{amountFormatted} · {responsibleLabel}',
                               startComponent: HotelPaymentConfirmedCell,
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Payments', 'Hotels', { event: 'event' });
