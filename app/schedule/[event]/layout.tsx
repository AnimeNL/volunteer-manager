// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound, unauthorized } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { ApplicationBar } from './components/ApplicationBar';
import { DesktopNavigation } from './components/DesktopNavigation';
import { MobileNavigation } from './components/MobileNavigation';
import { ScheduleContextManager } from './ScheduleContextManager';
import { ScheduleTheme } from './ScheduleTheme';
import { Temporal, isAfter } from '@lib/Temporal';
import { determineEnvironment } from '@lib/Environment';
import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tEventsTeams, tUsersEvents } from '@lib/database';

import { kDesktopMaximumWidthPx, kDesktopMenuWidthPx } from './Constants';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Styling rules used for <ScheduleLayout> and friends.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        margin: 'auto',
        maxWidth: {
            md: kDesktopMaximumWidthPx,
        },
        paddingRight: {
            md: 2,
        }
    },

    content: {
        flexGrow: 1,
        maxWidth: '100%',
        width: {
            md: `calc(100% - ${2 * kDesktopMenuWidthPx}px)`,
        },
        padding: 2,
    },
};

/**
 * The <ScheduleLayout> component is the main page of the scheduling tool, that allows volunteers to
 * access both their schedule and the program of the entire event. The layout supports both light
 * and dark mode, and is accessible on both desktop and mobile devices.
 */
export default async function ScheduleLayout(props: LayoutProps<'/schedule/[event]'>) {
    const authenticationContext = await getAuthenticationContext();
    if (!authenticationContext.user)
        unauthorized();  // only signed in users can access the schedule

    const { access, user } = authenticationContext;

    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const params = await props.params;

    const event = await getEventBySlug(params.event);
    if (!event)
        notFound();  // the requested |event| does not exist

    if (!access.can('event.schedule.access', { event: event.slug })) {
        if (!authenticationContext.events.has(event.slug))
            forbidden();  // the |user| is not participating in the |event|

        const scheduleAvailabilityWindows = await db.selectFrom(tUsersEvents)
            .innerJoin(tEventsTeams)
                .on(tEventsTeams.teamId.equals(tUsersEvents.teamId))
                    .and(tEventsTeams.eventId.equals(tUsersEvents.eventId))
            .where(tUsersEvents.userId.equals(user.id))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                start: tEventsTeams.enableScheduleStart,
                end: tEventsTeams.enableScheduleEnd,
            })
            .executeSelectMany();

        const currentTime = Temporal.Now.zonedDateTimeISO();

        let identifiedWindowWithAccess = false;
        for (const { start, end } of scheduleAvailabilityWindows) {
            if (!start || isAfter(start, currentTime))
                continue;  // the window has not opened yet

            if (!end || isAfter(end, currentTime)) {
                identifiedWindowWithAccess = true;
                break;
            }
        }

        if (!identifiedWindowWithAccess)
            forbidden();
    }

    return (
        <ScheduleTheme palette={environment.colours}>
            <ScheduleContextManager event={event.slug}>
                <ApplicationBar />
                <Stack direction="row" sx={kStyles.container}>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <DesktopNavigation />
                    </Box>
                    <Stack direction="column" spacing={2} sx={kStyles.content}>
                        {props.children}
                    </Stack>
                </Stack>
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <MobileNavigation />
                </Box>
            </ScheduleContextManager>
        </ScheduleTheme>
    );
}
