// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { AvailabilityToggle } from '@app/admin/components/AvailabilityToggle';
import { AvailabilityWindow } from '@app/admin/components/AvailabilityWindow';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { LogBuilder } from '@lib/log/index';
import { PriceCell, PrivateCell, PrivateHeader } from './HotelSettingsCells';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents, tHotels, tHotelsBookings } from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';

import { updateHotelConfiguration } from '../HotelsActions';

/**
 * Data source for managing the available hotel rooms for an event.
 */
const eventHotelSettingsDataSource = createDataSource('admin/event/hotels/settings', withContext({
    /**
     * Event for which hotel room settings are being configured.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of this entry in the configuration.
     */
    id: z.number(),

    /**
     * Name of the hotel in which the room is located.
     */
    hotelName: z.string(),

    /**
     * Description of the hotel in which the room is located.
     */
    hotelDescription: z.string().nullish(),

    /**
     * Name of the room that can be booked.
     */
    roomName: z.string(),

    /**
     * Capacity of the room.
     */
    roomPeople: z.number(),

    /**
     * Price of the room, in cents.
     */
    roomPrice: z.number(),

    /**
     * Whether this hotel room is private (only shown in the admin area unless assigned).
     */
    private: z.boolean(),

    /**
     * Whether this hotel room is protected from deletion due to existing bookings.
     */
    protected: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.hotels',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async create(partialRow, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        if (!partialRow.hotelName || !partialRow.roomName || !partialRow.roomPeople ||
            partialRow.roomPrice === undefined)
        {
            return false;  // required columns
        }

        const insertId = await db.insertInto(tHotels)
            .set({
                eventId: context.event.id,
                hotelName: partialRow.hotelName,
                hotelDescription: partialRow.hotelDescription ?? '',
                hotelRoomName: partialRow.roomName,
                hotelRoomPeople: partialRow.roomPeople,
                hotelRoomPrice: partialRow.roomPrice,
                hotelRoomPrivate: partialRow.private ? 1 : 0,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateHotelRoom')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                hotelName: partialRow.hotelName,
                roomName: partialRow.roomName,
            });

        return !!insertId;
    },

    async delete(row, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        const dbInstance = db;
        const activeBookings = await dbInstance.selectFrom(tHotelsBookings)
            .where(tHotelsBookings.bookingHotelId.equals(row.id))
                .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
            .selectCountAll()
            .executeSelectOne();

        if (activeBookings > 0)
            return false;

        const affectedRows = await dbInstance.update(tHotels)
            .set({
                hotelRoomDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tHotels.hotelId.equals(row.id))
                .and(tHotels.eventId.equals(context.event.id))
                .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
                .and(tHotels.hotelRoomDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('DeleteHotelRoom')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                hotelName: row.hotelName,
                roomName: row.roomName,
            });

        return !!affectedRows;
    },

    async list(params, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        const hotelsBookingsJoin = tHotelsBookings.forUseInLeftJoin();

        const dbInstance = db;
        const hotels = await dbInstance.selectFrom(tHotels)
            .leftJoin(hotelsBookingsJoin)
                .on(hotelsBookingsJoin.bookingHotelId.equals(tHotels.hotelId))
                    .and(hotelsBookingsJoin.bookingVisible.equals(/* true= */ 1))
            .where(tHotels.eventId.equals(context.event.id))
                .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
                .and(tHotels.hotelRoomDeleted.isNull())
            .select({
                id: tHotels.hotelId,
                hotelName: tHotels.hotelName,
                hotelDescription: tHotels.hotelDescription,
                roomName: tHotels.hotelRoomName,
                roomPeople: tHotels.hotelRoomPeople,
                roomPrice: tHotels.hotelRoomPrice,
                private: tHotels.hotelRoomPrivate.equals(/* true= */ 1),
                bookings: dbInstance.count(hotelsBookingsJoin.bookingId),
            })
            .groupBy(tHotels.hotelId)
            .orderBy(params.sort.field as any ?? 'hotelName', params.sort.direction)
                .orderBy(tHotels.hotelRoomName, 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: hotels.count,
            rows: hotels.data.map(hotel => ({
                id: hotel.id,
                hotelName: hotel.hotelName,
                hotelDescription: hotel.hotelDescription,
                roomName: hotel.roomName,
                roomPeople: hotel.roomPeople,
                roomPrice: hotel.roomPrice,
                private: !!hotel.private,
                protected: hotel.bookings > 0,
            })),
        };
    },

    async update(row, previousRow, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        const affectedRows = await db.update(tHotels)
            .set({
                hotelName: row.hotelName,
                hotelDescription: row.hotelDescription ?? '',
                hotelRoomName: row.roomName,
                hotelRoomPeople: row.roomPeople,
                hotelRoomPrice: row.roomPrice,
                hotelRoomPrivate: row.private ? 1 : 0,
            })
            .where(tHotels.hotelId.equals(row.id))
                .and(tHotels.eventId.equals(context.event.id))
                .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
                .and(tHotels.hotelRoomDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateHotelRoom')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withDiff({
                'Hotel name': {
                    before: previousRow.hotelName,
                    after: row.hotelName,
                },
                'Hotel description': {
                    before: previousRow.hotelDescription ?? '',
                    after: row.hotelDescription ?? '',
                },
                'Room name': {
                    before: previousRow.roomName,
                    after: row.roomName,
                },
                'Room people': {
                    before: previousRow.roomPeople,
                    after: row.roomPeople,
                },
                'Room price': {
                    before: previousRow.roomPrice,
                    after: row.roomPrice,
                },
                'Room private': {
                    before: previousRow.private,
                    after: row.private,
                },
            })
            .record({
                event: context.event.shortName,
                hotelName: row.hotelName,
                roomName: row.roomName,
            });

        return !!affectedRows;
    },
});

/**
 * The <EventHotelSettingsPage> page allows event administrators to configure available hotel room
 * options and preference windows for a particular event.
 */
export default async function EventHotelSettingsPage(
    props: PageProps<'/admin/events/[event]/hotels/settings'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.hotels');
    if (!event.flags.enableHotel)
        notFound();

    const dbInstance = db;
    const defaultValues = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            hotelInformationPublished: tEvents.hotelInformationPublished,
            hotelPreferencesStart: dbInstance.dateTimeAsString(tEvents.hotelPreferencesStart),
            hotelPreferencesEnd: dbInstance.dateTimeAsString(tEvents.hotelPreferencesEnd),
        })
        .projectingOptionalValuesAsNullable()
        .executeSelectNoneOrOne() ?? undefined;

    const action = updateHotelConfiguration.bind(null, event.slug);

    const columns: Column<ExtractRowModel<typeof eventHotelSettingsDataSource>>[] = [
        {
            field: 'hotelName',
            headerName: 'Hotel (name)',
            editable: true,
            sortable: true,
            flex: 2,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'hotelDescription',
            headerName: 'Hotel (description)',
            editable: true,
            sortable: false,
            flex: 2,

            template: 'text',
        },
        {
            field: 'roomName',
            headerName: 'Room (name)',
            editable: true,
            sortable: true,
            flex: 2,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'roomPeople',
            headerName: 'Room (people)',
            editable: true,
            sortable: true,
            type: 'number',
            flex: 1,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'roomPrice',
            headerName: 'Room (price)',
            editable: true,
            sortable: true,
            type: 'number',
            flex: 1,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: PriceCell,
            },
        },
        {
            field: 'private',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            description: 'Hide this room from the public?',
            editable: true,
            sortable: false,
            width: 50,

            type: 'boolean',

            template: 'component',
            templateProps: {
                headerComponent: PrivateHeader,
                component: PrivateCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <SettingsSuggestIcon color="primary" /> } title="Hotel settings"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Hotels', href: `/admin/events/${event.slug}/hotels` },
                         { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Settings regarding the hotel room and preference availability for{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={eventHotelSettingsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'hotelName', sort: 'asc' }}
                           disableFooter pageSize={100} protectedColumn="protected"
                           subject="hotel room"
                           listViewProps={{
                               primaryField: 'hotelName',
                               secondaryTemplate: '{roomName} ({roomPeople}p)',
                               startComponent: PrivateCell,
                               endComponent: PriceCell,
                           }} />
            </Section>
            <FormGridSection icon={ <PublishedWithChangesIcon /> } title="Availability"
                             action={action} defaultValues={defaultValues}
                             timezone={event.timeZone}>
                <SectionIntroduction grid>
                    Set the timeframe for accepting hotel preferences from volunteers.
                </SectionIntroduction>
                <AvailabilityToggle label="Publish information" name="hotelInformationPublished" />
                <AvailabilityWindow label="Accept preferences" start="hotelPreferencesStart"
                                    end="hotelPreferencesEnd" timezone={event.timeZone} />
            </FormGridSection>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', 'Hotels', { event: 'event' });
