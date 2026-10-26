// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import HistoryIcon from '@mui/icons-material/History';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { readUserSetting } from '@lib/UserSettings';
import db, { tHotels, tTeams, tUsers, tUsersEvents, tUsersEventsPreferencesHotel }
    from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Data source for recent changes to hotel room preferences made by volunteers.
 */
const historyDataSource = createDataSource('admin/event/hotels/assignments/history', withContext({
    /**
     * Event for which hotel preference history is being retrieved.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of this preference version entry.
     */
    id: z.string(),

    /**
     * Unique ID of the volunteer who made the change.
     */
    userId: z.number(),

    /**
     * Name of the volunteer who made the change.
     */
    name: z.string(),

    /**
     * Team slug of the volunteer, used to linkify their entry.
     */
    team: z.string(),

    /**
     * Formatted label of the preferred hotel room, or "Not interested".
     */
    hotel: z.string(),

    /**
     * Date (YYYY-MM-DD) on which the volunteer would like to check in.
     */
    checkIn: z.string().nullish(),

    /**
     * Date (YYYY-MM-DD) on which the volunteer would like to check out.
     */
    checkOut: z.string().nullish(),

    /**
     * Date and time (ISO 8601) at which the preference was recorded.
     */
    updated: z.string(),

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

        const hotelsJoin = tHotels.forUseInLeftJoin();

        const dbInstance = db;
        const preferences = await dbInstance.selectFrom(tUsersEventsPreferencesHotel)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEventsPreferencesHotel.userId))
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.eventId.equals(tUsersEventsPreferencesHotel.eventId))
                    .and(tUsersEvents.userId.equals(tUsersEventsPreferencesHotel.userId))
                    .and(tUsersEvents.registrationStatus.in([
                        kRegistrationStatus.Accepted,
                        kRegistrationStatus.Cancelled,
                    ]))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .leftJoin(hotelsJoin)
                .on(hotelsJoin.hotelId.equals(tUsersEventsPreferencesHotel.hotelRoomId))
            .where(tUsersEventsPreferencesHotel.eventId.equals(context.event.id))
                .and(tUsers.name.containsInsensitiveIfValue(params.search)
                    .or(hotelsJoin.hotelName.containsInsensitiveIfValue(params.search))
                    .or(hotelsJoin.hotelRoomName.containsInsensitiveIfValue(params.search)))
            .select({
                userId: tUsersEventsPreferencesHotel.userId,
                name: tUsers.name,
                team: tTeams.teamSlug,
                interested: tUsersEventsPreferencesHotel.hotelInterested,
                hotelName: hotelsJoin.hotelName,
                roomName: hotelsJoin.hotelRoomName,
                checkIn: dbInstance.dateAsString(tUsersEventsPreferencesHotel.hotelCheckIn),
                checkOut: dbInstance.dateAsString(tUsersEventsPreferencesHotel.hotelCheckOut),
                updated: dbInstance.dateTimeAsString(
                    tUsersEventsPreferencesHotel.preferenceVersion),
            })
            .groupBy(
                tUsersEventsPreferencesHotel.userId,
                tUsersEventsPreferencesHotel.preferenceVersion)
            .orderBy('updated', 'desc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: preferences.count,
            rows: preferences.data.map(preference => {
                let hotel = 'Not interested';
                if (preference.interested) {
                    hotel = preference.hotelName && preference.roomName
                        ? `${preference.hotelName} (${preference.roomName})`
                        : 'Unknown room';
                }

                return {
                    id: `${preference.userId}-${preference.updated}`,
                    userId: preference.userId,
                    name: preference.name,
                    team: preference.team,
                    hotel,
                    checkIn: preference.interested ? preference.checkIn : null,
                    checkOut: preference.interested ? preference.checkOut : null,
                    updated: preference.updated,
                };
            }),
        };
    },
});

/**
 * Props accepted by the <PreferenceHistorySection> component.
 */
interface PreferenceHistorySectionProps {
    /**
     * Unique slug of the event for which hotel preference history should be displayed.
     */
    event: string;

    /**
     * Unique ID of the signed-in user, to persist the section's expanded state.
     */
    userId: number;
}

/**
 * The <PreferenceHistorySection> component displays recent changes made by volunteers to their
 * hotel room preferences.
 */
export async function PreferenceHistorySection(props: PreferenceHistorySectionProps) {
    const defaultExpanded =
        await readUserSetting(props.userId, 'user-admin-hotels-expand-history') ?? false;

    const linkTemplate = `/admin/events/${props.event}/{team}/volunteers/{userId}/preferences/hotel`;

    const columns: Column<ExtractRowModel<typeof historyDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Volunteer',
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                href: linkTemplate,
            },
        },
        {
            field: 'hotel',
            headerName: 'Hotel room',
            sortable: false,
            flex: 3,

            template: 'text',
        },
        {
            field: 'checkIn',
            headerName: 'Check in',
            sortable: false,
            width: 125,

            template: 'date',
        },
        {
            field: 'checkOut',
            headerName: 'Check out',
            sortable: false,
            width: 125,

            template: 'date',
        },
        {
            field: 'updated',
            headerName: 'Updated',
            sortable: false,
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
    ];

    return (
        <ExpandableSection defaultExpanded={!!defaultExpanded} icon={ <HistoryIcon /> }
                           setting="user-admin-hotels-expand-history" title="Preference history">
            <DataTable columns={columns} source={historyDataSource}
                       context={{ event: props.event }}
                       defaultSort={{ field: 'updated', sort: 'desc' }}
                       disableQueryParams pageSize={5} subject="preference change"
                       listViewProps={{
                           primaryField: 'name',
                           secondaryTemplate: '{checkIn} – {checkOut} ({hotel})',
                           dateField: 'updated',
                           dateFieldFormat: 'YYYY-MM-DD',
                           linkTemplate,
                       }} />
        </ExpandableSection>
    );
}
