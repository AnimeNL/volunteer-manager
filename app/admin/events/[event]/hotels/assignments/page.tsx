// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import HotelIcon from '@mui/icons-material/Hotel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import type { HotelCommunicationCellContext } from './HotelAssignmentCells';
import { BooleanCell } from '@app/admin/components/DataTable/cells/BooleanCell';
import { DataTable } from '@app/admin/components/DataTable';
import { HotelCommunicationCell, HotelCommunicationHeaderCell, HotelOccupantCell }
    from './HotelAssignmentCells';
import { PendingAssignmentsSection } from './PendingAssignmentsSection';
import { PreferenceHistorySection } from './PreferenceHistorySection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { assignmentsDataSource } from './HotelAssignmentsDataSource';
import { compileDateWarnings } from './compileDateWarnings';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tHotels } from '@lib/database';

import { sendHotelConfirmationCommunication } from '../HotelsActions';

/**
 * The <EventHotelAssignmentsPage> page allows event administrators to view and manage hotel room
 * assignments for volunteers participating in a particular event.
 */
export default async function EventHotelAssignmentsPage(
    props: PageProps<'/admin/events/[event]/hotels/assignments'>)
{
    const { event, user } = await requireAuthenticationWithEvent(props, 'event.hotels');
    if (!event.flags.enableHotel)
        notFound();

    const hotels = await db.selectFrom(tHotels)
        .where(tHotels.eventId.equals(event.id))
            .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
            .and(tHotels.hotelRoomDeleted.isNull())
        .select({
            id: tHotels.hotelId,
            hotelName: tHotels.hotelName,
            roomName: tHotels.hotelRoomName,
        })
        .orderBy(tHotels.hotelName, 'asc')
            .orderBy(tHotels.hotelRoomName, 'asc')
        .executeSelectMany();

    const rooms = hotels.map(hotel => ({
        value: hotel.id,
        label: `${hotel.hotelName} (${hotel.roomName})`,
    }));

    const columns: Column<ExtractRowModel<typeof assignmentsDataSource>>[] = [
        {
            field: 'firstName',
            headerName: 'Booking owner',
            editable: true,
            sortable: true,
            flex: 1,

            template: 'component',
            templateProps: {
                component: HotelOccupantCell,
                componentContext: {
                    event: event.slug,
                    occupant: 'first',
                },
            },

            editorProps: {
                required: true,
            },
        },
        {
            field: 'secondName',
            headerName: 'Second guest',
            editable: true,
            sortable: false,
            flex: 1,

            template: 'component',
            templateProps: {
                component: HotelOccupantCell,
                componentContext: {
                    event: event.slug,
                    occupant: 'second',
                },
            },
        },
        {
            field: 'thirdName',
            headerName: 'Third guest',
            editable: true,
            sortable: false,
            flex: 1,

            template: 'component',
            templateProps: {
                component: HotelOccupantCell,
                componentContext: {
                    event: event.slug,
                    occupant: 'third',
                },
            },
        },
        {
            field: 'hotelId',
            headerName: 'Hotel room',
            editable: true,
            sortable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: rooms,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'checkIn',
            headerName: 'Check in',
            editable: true,
            sortable: true,
            width: 125,

            template: 'date',

            editorProps: {
                placeholder: 'YYYY-MM-DD',
                required: true,
            },
        },
        {
            field: 'checkOut',
            headerName: 'Check out',
            editable: true,
            sortable: true,
            width: 125,

            template: 'date',

            editorProps: {
                placeholder: 'YYYY-MM-DD',
                required: true,
            },
        },
        {
            field: 'confirmed',
            description: 'Has this room been booked?',
            editable: true,
            sortable: true,
            type: 'boolean',

            template: 'boolean',
            templateProps: {
                tooltips: {
                    header: 'Has the hotel room been booked?',
                    falsyValue: 'Booking has not been confirmed',
                    truthyValue: 'Booking has been confirmed',
                },
            },
        },
        {
            field: 'hotelDescription',  // unrelated
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            editable: false,
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                component: HotelCommunicationCell,
                componentContext: {
                    action: sendHotelConfirmationCommunication.bind(null, event.slug),
                    eventId: event.id,
                } satisfies HotelCommunicationCellContext,
                headerComponent: HotelCommunicationHeaderCell,
            },
        },
    ];

    const warnings = await compileDateWarnings(event.id);

    return (
        <>
            <Section icon={ <HotelIcon color="primary" /> } title="Hotel assignments"
                     documentation="event/hotels"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Hotels', href: `/admin/events/${event.slug}/hotels` },
                         { label: 'Assignments' },
                     ]}>
                <SectionIntroduction>
                    Hotel room assignments and pending requests for {event.shortName} volunteers.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={assignmentsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'firstName', sort: 'asc' }}
                           disableFooter pageSize={100} refreshOnMutation subject="hotel booking"
                           listViewProps={{
                               primaryField: 'firstName',
                               secondaryTemplate: '{hotelDescription} ({checkIn} – {checkOut})',
                               startComponent: BooleanCell,
                               startComponentContext: { field: 'confirmed' },
                           }} />
                <Collapse in={warnings.length > 0}>
                    <Alert severity="warning" variant="outlined">
                        <Stack direction="column" spacing={0} sx={{ maxWidth: '100%' }}>
                            { warnings.map(({ volunteer, warning }, index) =>
                                <Typography key={index} variant="body2">
                                    <strong>{volunteer}</strong> {warning}
                                </Typography> )}
                        </Stack>
                    </Alert>
                </Collapse>
            </Section>
            <PendingAssignmentsSection event={event} userId={user.id} />
            <PreferenceHistorySection event={event.slug} userId={user.id} />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Assignments', 'Hotels', { event: 'event' });
