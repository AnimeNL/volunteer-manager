// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tHotels, tHotelsAssignments, tHotelsBookings, tHotelsPreferences, tTeams, tUsers,
    tUsersEvents } from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Row model for a pending hotel request.
 */
interface HotelPendingAssignmentRowModel {
    /**
     * Unique ID of the volunteer who requested a hotel room.
     */
    id: number;

    /**
     * Name of the volunteer.
     */
    name: string;

    /**
     * URL-safe slug identifying the team the volunteer is part of.
     */
    team: string;

    /**
     * Name of the hotel and room they would like to book.
     */
    hotel: string;

    /**
     * Date (YYYY-MM-DD) on which the volunteer would like to check in.
     */
    checkIn: string;

    /**
     * Date (YYYY-MM-DD) on which the volunteer would like to check out.
     */
    checkOut: string;

    /**
     * Date (YYYY-MM-DD) on which the volunteer requested the hotel room.
     */
    requested: string;
}

/**
 * Data source for volunteers whose hotel room requests are pending assignment.
 */
const pendingAssignmentDataSource = createDataSource('admin/events/hotels/pending-assignment',
    withContext(
{
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
     * Date (YYYY-MM-DD) on which the volunteer requested the hotel room.
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
        const dbInstance = db;

        const assignments = await dbInstance.selectFrom(tHotelsAssignments)
            .innerJoin(tHotelsBookings)
                .on(tHotelsBookings.bookingId.equals(tHotelsAssignments.bookingId))
                    .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
            .where(tHotelsAssignments.eventId.equals(context.event.id))
                .and(tHotelsAssignments.assignmentUserId.isNotNull())
            .select({
                userId: tHotelsAssignments.assignmentUserId,
            })
            .executeSelectMany();

        const assignedUserIds = new Set(assignments.map(a => a.userId!));

        const hotels = await dbInstance.selectFrom(tHotels)
            .where(tHotels.eventId.equals(context.event.id))
                .and(tHotels.hotelRoomDeleted.isNull())
            .select({
                id: tHotels.hotelId,
                hotelName: tHotels.hotelName,
                roomName: tHotels.hotelRoomName,
            })
            .executeSelectMany();

        const hotelMap = new Map(hotels.map(h => [ h.id, `${h.hotelName} (${h.roomName})` ]));

        const preferences = await dbInstance.selectFrom(tHotelsPreferences)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tHotelsPreferences.userId))
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.userId.equals(tHotelsPreferences.userId))
                    .and(tUsersEvents.eventId.equals(tHotelsPreferences.eventId))
                    .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tHotelsPreferences.teamId))
            .where(tHotelsPreferences.eventId.equals(context.event.id))
                .and(tHotelsPreferences.hotelId.isNotNull())
                .and(tHotelsPreferences.hotelDateCheckIn.isNotNull())
                .and(tHotelsPreferences.hotelDateCheckOut.isNotNull())
            .select({
                id: tHotelsPreferences.userId,
                name: tUsers.name,
                team: tTeams.teamSlug,
                hotelId: tHotelsPreferences.hotelId,
                checkIn: tHotelsPreferences.hotelDateCheckIn,
                checkOut: tHotelsPreferences.hotelDateCheckOut,
                requested:
                    dbInstance.dateTimeAsString(tHotelsPreferences.hotelPreferencesUpdated),
            })
            .executeSelectMany();

        let rows: HotelPendingAssignmentRowModel[] = [];
        for (const preference of preferences) {
            if (assignedUserIds.has(preference.id))
                continue;

            const hotel = hotelMap.get(preference.hotelId!);
            if (!hotel)
                continue;

            rows.push({
                id: preference.id,
                name: preference.name,
                team: preference.team,
                hotel: hotel,
                checkIn: preference.checkIn!.toString(),
                checkOut: preference.checkOut!.toString(),
                requested: preference.requested.substring(0, 10),
            });
        }

        const field = params.sort.field;
        const direction = params.sort.direction;

        rows.sort((a, b) => {
            let comparison = 0;
            switch (field) {
                case 'name':
                case 'hotel':
                case 'checkIn':
                case 'checkOut':
                case 'requested':
                    comparison = a[field].localeCompare(b[field]);
                    break;
            }
            return direction === 'asc' ? comparison : -comparison;
        });

        const rowCount = rows.length;
        const paginatedRows = rows.slice(
            params.page.offset, params.page.offset + params.page.limit);

        return {
            rowCount: rowCount,
            rows: paginatedRows,
        };
    },
});

/**
 * Props accepted by the <HotelPendingAssignment> component.
 */
interface HotelPendingAssignmentProps {
    /**
     * Slug of the event for which pending hotel requests should be displayed.
     */
    event: string;
}

/**
 * The <HotelPendingAssignment> component displays the volunteers who have expressed interest in
 * having a hotel room booking, but have not been assigned a room just yet.
 */
export async function HotelPendingAssignment(props: HotelPendingAssignmentProps) {
    const columns: Column<ExtractRowModel<typeof pendingAssignmentDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Volunteer',
            sortable: true,
            flex: 2,

            template: 'text',
            templateProps: {
                href: './{team}/volunteers/{id}',
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

    return (
        <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
                Pending assignment
            </Typography>
            <DataTable columns={columns} source={pendingAssignmentDataSource}
                       context={{ event: props.event }}
                       defaultSort={{ field: 'name', sort: 'asc' }}
                       disableFooter pageSize={100}
                       listViewProps={{
                           primaryField: 'name',
                           secondaryField: 'hotel',
                           linkTemplate: './{team}/volunteers/{id}',
                       }} />
        </Paper>
    );
}
