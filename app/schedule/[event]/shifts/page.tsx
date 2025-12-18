// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { VolunteerPage } from '../volunteers/[volunteer]/VolunteerPage';

/**
 * The <ScheduleShiftsPage> component displays the regular volunteer page for the signed in user,
 * only available in case they have a role and shifts in the current event.
 *
 * While data is exclusively sourced from the context, authentication is performed in order to
 * discover the user ID of the person signed in to the Volunteer Manager.
 */
export default async function ScheduleShiftsPage(props: PageProps<'/schedule/[event]/shifts'>) {
    const params = await props.params;
    const { user } = await requireAuthenticationContext({ check: 'event', event: params.event });

    return <VolunteerPage userId={`${user.id}`} />;
}
