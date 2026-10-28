// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import PaidIcon from '@mui/icons-material/Paid';

import type { Column } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { HotelPaymentAmountCell, HotelPaymentConfirmedCell, HotelPaymentConfirmedHeader,
    HotelPaymentGuestCell } from './HotelPaymentCells';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tHotels, tHotelsBookings, tHotelsPayments, tRoles, tTeams, tUsers, tUsersEvents }
    from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';
import { kHotelPaymentResponsible } from '@lib/database/Types';

/**
 * Helper function for formatting payment amounts in mobile list views.
 */
const kPriceFormatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

/**
 * Row model for the hotel payments data table.
 */
const kHotelPaymentRowModel = withRowModel({
    /**
     * Unique ID of this guest payment entry (the guest's name).
     */
    id: z.string(),

    /**
     * Name, user ID and team slug of the guest.
     */
    name: z.string(),
    userId: z.number().nullish(),
    team: z.string().nullish(),

    /**
     * Number of confirmed hotel bookings this guest is part of.
     */
    bookings: z.number(),

    /**
     * Earliest date (YYYY-MM-DD) on which the guest will be checking in.
     */
    checkIn: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/),

    /**
     * Latest date (YYYY-MM-DD) on which the guest will be checking out.
     */
    checkOut: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/),

    /**
     * Amount to be paid, in cents.
     */
    amount: z.number().nullish(),

    /**
     * Whether the amount is a calculated default rather than an explicitly saved value.
     */
    amountIsDefault: z.boolean().optional(),

    /**
     * Formatted amount for mobile display.
     */
    amountFormatted: z.string().nullish(),

    /**
     * Party responsible for settling the payment.
     */
    responsible: z.enum(kHotelPaymentResponsible).or(z.literal('')).nullish(),

    /**
     * Formatted responsible party label for mobile display.
     */
    responsibleLabel: z.string().nullish(),

    /**
     * Whether the payment has been received.
     */
    confirmed: z.boolean(),
});

/**
 * Type of a hotel payment row model.
 */
type HotelPaymentRowModel = z.infer<typeof kHotelPaymentRowModel>;

/**
 * Aggregated booking summary for a single guest across all confirmed bookings for an event.
 */
interface GuestBookingSummary {
    name: string;
    userId?: number;
    bookings: number;
    checkIn: string;
    checkOut: string;
    defaultAmount?: number;
}

/**
 * Data source for managing hotel room payments for an event.
 */
const paymentsDataSource = createDataSource('admin/event/hotels/payments', withContext({
    /**
     * Event for which hotel room payments are being managed.
     */
    event: kEventTransformer,

}), kHotelPaymentRowModel, {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.hotels',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        const firstUserJoin = tUsers.forUseInLeftJoinAs('fu');
        const secondUserJoin = tUsers.forUseInLeftJoinAs('su');
        const thirdUserJoin = tUsers.forUseInLeftJoinAs('tu');

        const hotelsJoin = tHotels.forUseInLeftJoin();

        const dbInstance = db;
        const [ bookings, paymentData ] = await Promise.all([
            dbInstance.selectFrom(tHotelsBookings)
                .leftJoin(hotelsJoin)
                    .on(hotelsJoin.hotelId.equals(tHotelsBookings.bookingHotelId))
                        .and(hotelsJoin.hotelRoomDeleted.isNull())
                .leftJoin(firstUserJoin)
                    .on(firstUserJoin.userId.equals(tHotelsBookings.bookingFirstUserId))
                .leftJoin(secondUserJoin)
                    .on(secondUserJoin.userId.equals(tHotelsBookings.bookingSecondUserId))
                .leftJoin(thirdUserJoin)
                    .on(thirdUserJoin.userId.equals(tHotelsBookings.bookingThirdUserId))
                .where(tHotelsBookings.eventId.equals(context.event.id))
                    .and(tHotelsBookings.bookingConfirmed.isNotNull())
                    .and(tHotelsBookings.bookingDeleted.isNull())
                .select({
                    id: tHotelsBookings.bookingId,

                    firstName: tHotelsBookings.bookingFirstName.valueWhenNull(firstUserJoin.name),
                    firstUserId: tHotelsBookings.bookingFirstUserId,

                    secondName:
                        tHotelsBookings.bookingSecondName.valueWhenNull(secondUserJoin.name),
                    secondUserId: tHotelsBookings.bookingSecondUserId,

                    thirdName: tHotelsBookings.bookingThirdName.valueWhenNull(thirdUserJoin.name),
                    thirdUserId: tHotelsBookings.bookingThirdUserId,

                    checkIn: tHotelsBookings.bookingCheckIn,
                    checkOut: tHotelsBookings.bookingCheckOut,
                    roomPrice: hotelsJoin.hotelRoomPrice,
                })
                .orderBy(tHotelsBookings.bookingId, 'asc')
                .executeSelectMany(),

            dbInstance.selectFrom(tHotelsPayments)
                .where(tHotelsPayments.eventId.equals(context.event.id))
                .select({
                    name: tHotelsPayments.paymentName,
                    amount: tHotelsPayments.paymentAmount,
                    responsible: tHotelsPayments.paymentResponsible,
                    confirmed: tHotelsPayments.paymentConfirmed.isNotNull(),
                })
                .executeSelectMany(),
        ]);

        if (!bookings.length)
            return { rowCount: 0, rows: [] };

        const userIds = new Set<number>();
        for (const booking of bookings) {
            if (booking.firstUserId)
                userIds.add(booking.firstUserId);
            if (booking.secondUserId)
                userIds.add(booking.secondUserId);
            if (booking.thirdUserId)
                userIds.add(booking.thirdUserId);
        }

        const volunteerData = userIds.size > 0
            ? await dbInstance.selectFrom(tUsersEvents)
                  .innerJoin(tRoles)
                      .on(tRoles.roleId.equals(tUsersEvents.roleId))
                  .innerJoin(tTeams)
                      .on(tTeams.teamId.equals(tUsersEvents.teamId))
                  .where(tUsersEvents.eventId.equals(context.event.id))
                      .and(tUsersEvents.userId.in([ ...userIds ]))
                  .select({
                      userId: tUsersEvents.userId,
                      team: tTeams.teamSlug,
                  })
                  .executeSelectMany()
            : [];

        const volunteerTeams = new Map<number, string>();
        for (const volunteer of volunteerData)
            volunteerTeams.set(volunteer.userId, volunteer.team);

        const payments = new Map<string, typeof paymentData[number]>();
        for (const payment of paymentData)
            payments.set(payment.name, payment);

        const guests = new Map<string, GuestBookingSummary>();

        for (const booking of bookings) {
            const rawOccupants = [
                { name: booking.firstName, userId: booking.firstUserId },
                { name: booking.secondName, userId: booking.secondUserId },
                { name: booking.thirdName, userId: booking.thirdUserId },
            ];

            const seenNames = new Set<string>();
            const validOccupants: { name: string; userId?: number }[] = [];
            for (const occupant of rawOccupants) {
                const trimmedName = occupant.name?.trim();
                if (!trimmedName || seenNames.has(trimmedName))
                    continue;

                seenNames.add(trimmedName);
                validOccupants.push({ name: trimmedName, userId: occupant.userId });
            }

            if (!validOccupants.length)
                continue;

            const nights = Math.max(0, booking.checkOut.since(booking.checkIn).days);
            const bookingShare = booking.roomPrice !== undefined
                ? Math.round((booking.roomPrice * nights) / validOccupants.length)
                : undefined;

            const checkIn = booking.checkIn.toString();
            const checkOut = booking.checkOut.toString();

            for (const occupant of validOccupants) {
                const existing = guests.get(occupant.name);
                if (!existing) {
                    guests.set(occupant.name, {
                        name: occupant.name,
                        userId: occupant.userId,
                        bookings: 1,
                        checkIn,
                        checkOut,
                        defaultAmount: bookingShare,
                    });
                } else {
                    existing.bookings += 1;
                    if (!existing.userId && occupant.userId)
                        existing.userId = occupant.userId;
                    if (checkIn < existing.checkIn)
                        existing.checkIn = checkIn;
                    if (checkOut > existing.checkOut)
                        existing.checkOut = checkOut;
                    if (bookingShare !== undefined)
                        existing.defaultAmount = (existing.defaultAmount ?? 0) + bookingShare;
                }
            }
        }

        const rows: HotelPaymentRowModel[] = [];

        for (const guest of guests.values()) {
            const payment = payments.get(guest.name);
            const hasSavedAmount = payment?.amount !== undefined && payment?.amount !== null;
            const amount = hasSavedAmount ? payment.amount : guest.defaultAmount;
            const responsible = payment?.responsible ?? '';

            rows.push({
                id: guest.name,
                name: guest.name,
                userId: guest.userId,
                team: guest.userId ? volunteerTeams.get(guest.userId) : undefined,
                bookings: guest.bookings,
                checkIn: guest.checkIn,
                checkOut: guest.checkOut,
                amount,
                amountIsDefault: !hasSavedAmount,
                amountFormatted:
                    amount !== undefined ? kPriceFormatter.format(amount / 100) : 'Unknown',
                responsible,
                responsibleLabel: responsible || 'Unassigned',
                confirmed: !!payment?.confirmed,
            });
        }

        rows.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

        return {
            rowCount: rows.length,
            rows: rows.slice(params.page.offset, params.page.offset + params.page.limit),
        };
    },

    async update(row, previousRow, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        const dbInstance = db;

        const paymentAmount = row.amount ?? 0;
        const paymentResponsible =
            !row.responsible ? kHotelPaymentResponsible.Self : row.responsible;
        const paymentConfirmed =
            previousRow.confirmed !== row.confirmed
                ? (row.confirmed ? dbInstance.currentZonedDateTime() : null)
                : undefined;

        const affectedRows = await dbInstance.insertInto(tHotelsPayments)
            .set({
                eventId: context.event.id,
                paymentName: row.name,
                paymentAmount,
                paymentResponsible,
                paymentConfirmed:
                    paymentConfirmed !== undefined
                        ? paymentConfirmed
                        : (row.confirmed ? dbInstance.currentZonedDateTime() : null),
            })
            .onConflictDoUpdateSet({
                paymentAmount,
                paymentResponsible,
                paymentConfirmed,
            })
            .executeInsert();

        LogBuilder.for('UpdateHotelPayment')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(row.userId ?? undefined)
            .record({
                event: context.event.shortName,
                occupant: row.name,
            });

        return !!affectedRows ? {
            ...row,
            amount: paymentAmount,
            amountIsDefault: false,
            amountFormatted: kPriceFormatter.format(paymentAmount / 100),
            responsible: paymentResponsible,
            responsibleLabel: paymentResponsible,
            confirmed: !!row.confirmed,
        } : false;
    },
});

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
