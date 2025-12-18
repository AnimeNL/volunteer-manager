// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Collapse from '@mui/material/Collapse';

import { HotelAssignment } from './HotelAssignment';
import { HotelConfiguration } from './HotelConfiguration';
import { HotelPendingAssignment } from './HotelPendingAssignment';
import { HotelProcessor } from './HotelProcessor';
import { generateEventMetadataFn } from '../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <EventHotelsPage> page allows event administrators to see and make changes to the hotel room
 * situation for a particular event, including assigning rooms (and roommates!) to volunteers.
 */
export default async function EventHotelsPage(props: PageProps<'/admin/events/[event]/hotels'>) {
    const params = await props.params;

    const { event } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.hotels',
        scope: {
            event: params.event,
        },
    });

    if (!event.hotelEnabled)
        notFound();

    const processor = new HotelProcessor(event.id);
    await processor.initialise();

    // An alphabetically ordered list of volunteers who have requested a hotel room.
    const requests = processor.composeRequestOptions();

    // An alphabetically ordered list of the visible hotel room options.
    const rooms = processor.composeRoomOptions();

    // An alphabetically ordered list of volunteers whose requests have not been fulfilled yet.
    const unassignedRequests = processor.compileUnassignedRequests();

    // A prioritised list of the warnings in the current hotel room planning.
    const warnings = processor.compileWarnings();

    return (
        <>
            <HotelAssignment event={event} requests={requests} rooms={rooms} warnings={warnings} />
            <Collapse in={!!unassignedRequests.length} sx={{ mt: '0px !important' }}>
                <HotelPendingAssignment requests={unassignedRequests} />
            </Collapse>
            <HotelConfiguration event={event} />
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Hotels');
