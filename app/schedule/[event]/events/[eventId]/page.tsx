// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { EventPage } from './EventPage';
import { requireAuthentication } from '../../requireAuthentication';

/**
 * The <ScheduleEventPage> component display a page for a particular event. It lists information
 * about the event, its timeslots, as well as volunteers who are scheduled for those times.
 */
export default async function ScheduleEventPage(
    props: PageProps<'/schedule/[event]/events/[eventId]'>)
{
    await requireAuthentication(props);

    const params = await props.params;
    return <EventPage activityId={params.eventId} />;
}
