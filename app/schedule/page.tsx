// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { redirect } from 'next/navigation';

import { getAuthenticationContext } from '@lib/auth';
import db, { tEvents } from '@lib/database';

/**
 * The <EventlessSchedulePage> component redirects the user back either the schedule for the most
 * recent event they're participating in, or the homepage when there is none. Schedules can only
 * be accessed for a specific event, so the event-less page is deliberately disabled.
 */
export default async function EventlessSchedulePage() {
    const authenticationContext = await getAuthenticationContext();
    if (authenticationContext.user) {
        const participatingEvents = [ ...authenticationContext.events.keys() ];

        const eventSlug = await db.selectFrom(tEvents)
            .where(tEvents.eventHidden.equals(/* false= */ 0))
                .and(tEvents.eventSlug.in(participatingEvents))
            .selectOneColumn(tEvents.eventSlug)
            .orderBy(tEvents.eventStartTime, 'desc')
            .limit(1)
            .executeSelectNoneOrOne();

        if (!!eventSlug)
            redirect(`/schedule/${eventSlug}`);
    }

    redirect('/');
}
