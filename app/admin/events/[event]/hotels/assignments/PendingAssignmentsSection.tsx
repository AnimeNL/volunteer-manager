// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import PendingActionsIcon from '@mui/icons-material/PendingActions';

import type { CachedEvent } from '@lib/cache';
import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { readUserSetting } from '@lib/UserSettings';
import db, { tHotels, tHotelsBookings, tTeams, tUsers, tUsersEvents,
    tUsersEventsPreferencesHotel } from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Data source for volunteers whose hotel room requests are pending assignment.
 */
const pendingDataSource = createDataSource('admin/event/hotels/assignments/pending', withContext({
    /**
     * Event for which pending hotel requests are being retrieved.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the volunteer who requested a hotel room.
     */
    id: z.number(),

    /**
     * Name of the volunteer.
     */
    name: z.string(),

    /**
     * URL-safe slug identifying the team the volunteer is part of.
     */
    team: z.string(),

    /**
     * Name of the hotel and room they would like to book.
     */
    hotel: z.string(),

    /**
     * Date (YYYY-MM-DD) on which the volunteer would like to check in.
     */
    checkIn: z.string(),

    /**
     * Date (YYYY-MM-DD) on which the volunteer would like to check out.
     */
    checkOut: z.string(),

    /**
     * Date and time on which the volunteer requested the hotel room.
     */
    requested: z.string(),

}), {
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

        const hotelsBookingsJoin = tHotelsBookings.forUseInLeftJoin();

        const sortField =
            params.sort.field === 'hotel' ? 'hotelName' : (params.sort.field ?? 'name');

        const dbInstance = db;
        const preferences = await dbInstance.selectFrom(tUsersEventsPreferencesHotel)
            .innerJoin(tHotels)
                .on(tHotels.hotelId.equals(tUsersEventsPreferencesHotel.hotelRoomId))
                    .and(tHotels.hotelRoomDeleted.isNull())
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEventsPreferencesHotel.userId))
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.userId.equals(tUsersEventsPreferencesHotel.userId))
                    .and(tUsersEvents.eventId.equals(tUsersEventsPreferencesHotel.eventId))
                    .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .leftJoin(hotelsBookingsJoin)
                .on(hotelsBookingsJoin.eventId.equals(tUsersEventsPreferencesHotel.eventId))
                    .and(hotelsBookingsJoin.bookingDeleted.isNull())
                    .and(hotelsBookingsJoin.bookingFirstUserId.equals(
                        tUsersEventsPreferencesHotel.userId).or(
                        hotelsBookingsJoin.bookingSecondUserId.equals(
                            tUsersEventsPreferencesHotel.userId)).or(
                        hotelsBookingsJoin.bookingThirdUserId.equals(
                            tUsersEventsPreferencesHotel.userId)))
            .where(tUsersEventsPreferencesHotel.eventId.equals(context.event.id))
                .and(tUsersEventsPreferencesHotel.preferenceVersionIsLatest.equals(/* true= */ 1))
                .and(tUsersEventsPreferencesHotel.hotelRoomId.isNotNull())
                .and(tUsersEventsPreferencesHotel.hotelCheckIn.isNotNull())
                .and(tUsersEventsPreferencesHotel.hotelCheckOut.isNotNull())
                .and(hotelsBookingsJoin.bookingId.isNull())
            .select({
                id: tUsersEventsPreferencesHotel.userId,
                name: tUsers.name,
                team: tTeams.teamSlug,
                hotelName: tHotels.hotelName,
                roomName: tHotels.hotelRoomName,
                checkIn: dbInstance.dateAsString(tUsersEventsPreferencesHotel.hotelCheckIn),
                checkOut: dbInstance.dateAsString(tUsersEventsPreferencesHotel.hotelCheckOut),
                requested:
                    dbInstance.dateTimeAsString(tUsersEventsPreferencesHotel.preferenceVersion),
            })
            .orderBy(sortField as any, params.sort.direction)
                .orderBy('name', 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: preferences.count,
            rows: preferences.data.map(preference => ({
                id: preference.id,
                name: preference.name,
                team: preference.team,
                hotel: `${preference.hotelName} (${preference.roomName})`,
                checkIn: preference.checkIn!,
                checkOut: preference.checkOut!,
                requested: preference.requested,
            })),
        };
    },
});

/**
 * Props accepted by the <PendingAssignmentsSection> component.
 */
interface PendingAssignmentsSectionProps {
    /**
     * Information about the event for which pending hotel requests should be displayed.
     */
    event: CachedEvent;

    /**
     * Unique ID of the signed-in user, to persist the section's expanded state.
     */
    userId: number;
}

/**
 * Displays a collapsible section listing volunteers who have requested a hotel room, but have not
 * yet been assigned one.
 */
export async function PendingAssignmentsSection(props: PendingAssignmentsSectionProps) {
    const { event, userId } = props;

    const hotelsBookingsJoin = tHotelsBookings.forUseInLeftJoin();

    const pendingAssignmentsCount = await db.selectFrom(tUsersEventsPreferencesHotel)
        .innerJoin(tHotels)
            .on(tHotels.hotelId.equals(tUsersEventsPreferencesHotel.hotelRoomId))
                .and(tHotels.hotelRoomDeleted.isNull())
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.userId.equals(tUsersEventsPreferencesHotel.userId))
                .and(tUsersEvents.eventId.equals(tUsersEventsPreferencesHotel.eventId))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(hotelsBookingsJoin)
            .on(hotelsBookingsJoin.eventId.equals(tUsersEventsPreferencesHotel.eventId))
                .and(hotelsBookingsJoin.bookingDeleted.isNull())
                .and(hotelsBookingsJoin.bookingFirstUserId.equals(
                    tUsersEventsPreferencesHotel.userId).or(
                    hotelsBookingsJoin.bookingSecondUserId.equals(
                        tUsersEventsPreferencesHotel.userId)).or(
                    hotelsBookingsJoin.bookingThirdUserId.equals(
                        tUsersEventsPreferencesHotel.userId)))
        .where(tUsersEventsPreferencesHotel.eventId.equals(event.id))
            .and(tUsersEventsPreferencesHotel.preferenceVersionIsLatest.equals(/* true= */ 1))
            .and(tUsersEventsPreferencesHotel.hotelRoomId.isNotNull())
            .and(tUsersEventsPreferencesHotel.hotelCheckIn.isNotNull())
            .and(tUsersEventsPreferencesHotel.hotelCheckOut.isNotNull())
            .and(hotelsBookingsJoin.bookingId.isNull())
        .selectCountAll()
        .executeSelectOne();

    if (!pendingAssignmentsCount)
        return null;

    const defaultExpanded = await readUserSetting(userId, 'user-admin-hotels-expand-pending');

    const volunteerPreferencesHref =
        `/admin/events/${event.slug}/{team}/volunteers/{id}/preferences`;

    const columns: Column<ExtractRowModel<typeof pendingDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Volunteer',
            sortable: true,
            flex: 2,

            template: 'text',
            templateProps: {
                href: volunteerPreferencesHref,
            },
        },
        {
            field: 'hotel',
            headerName: 'Hotel room',
            sortable: true,
            flex: 3,
        },
        {
            field: 'checkIn',
            headerName: 'Check in',
            sortable: true,
            width: 185,

            template: 'date',
        },
        {
            field: 'checkOut',
            headerName: 'Check out',
            sortable: true,
            width: 185,

            template: 'date',
        },
        {
            field: 'requested',
            headerName: 'Requested',
            sortable: true,
            width: 185,

            template: 'date',
        },
    ];

    const subtitle =
        `${pendingAssignmentsCount} volunteer${pendingAssignmentsCount === 1 ? '' : 's'}`;

    return (
        <ExpandableSection defaultExpanded={!!defaultExpanded} icon={ <PendingActionsIcon /> }
                           setting="user-admin-hotels-expand-pending" subtitle={subtitle}
                           title="Pending assignment">
            <DataTable columns={columns} source={pendingDataSource}
                       context={{ event: event.slug }}
                       defaultSort={{ field: 'name', sort: 'asc' }}
                       disableFooter pageSize={100}
                       listViewProps={{
                           primaryField: 'name',
                           secondaryTemplate: '{checkIn} – {checkOut} ({hotel})',
                           linkTemplate: volunteerPreferencesHref,
                       }} />
        </ExpandableSection>
    );
}
