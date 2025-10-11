// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type React from 'react';
import Link from '@app/LinkProxy';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { deepmerge } from '@mui/utils';

import type { Environment } from '@lib/Environment';
import type { EnvironmentContextEventAccess, EnvironmentContextEventAvailabilityStatus } from '@lib/EnvironmentContext';
import { Temporal, isBefore } from '@lib/Temporal';
import { Markdown } from '@components/Markdown';

/**
 * Manual styles that apply to the <WelcomeCard> client component.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    landingPage: {
        minHeight: { md: 340 },
        mt: 0,
        mr: '-0.5px' /* ... */
    },

    photoInline: {
        display: { xs: 'none', md: 'block' },
        position: 'relative',

        backgroundPosition: 'top left',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        borderBottomRightRadius: 4,
        alignSelf: 'stretch',
    },
};

/**
 * Props accepted by the <EventsContent> component.
 */
interface EventsContentProps {
    /**
     * The environment for which the landing page is being shown.
     */
    environment: Environment;

    /**
     * The events that should be shown on this page. At most two events will be included.
     */
    events: EnvironmentContextEventAccess[];
}

/**
 * The <EventsContent> component represents the case when the visitor has access to one or more
 * events, which should show clear call-to-actions for the visitor to access or participate in.
 */
export function EventsContent(props: EventsContentProps) {
    const currentTime = Temporal.Now.zonedDateTimeISO('utc');

    const photoStyle = deepmerge(kStyles.photoInline, {
        // TODO: Support multiple photos per environment, and rotate them periodically
        backgroundImage: `url('/images/${props.environment.domain}/landing.jpg')`,
    });

    // ---------------------------------------------------------------------------------------------

    const buttons: React.ReactNode[] = [ /* no buttons yet */ ];
    for (const event of props.events) {
        let registrationStatus: EnvironmentContextEventAvailabilityStatus | undefined;
        let scheduleStatus: EnvironmentContextEventAvailabilityStatus | undefined;

        // Escalate the |registrationStatus| and |scheduleStatus| values to "active" when feasible,
        // "override" when possible otherwise, or leave them untouched.
        for (const team of event.teams) {
            if (team.registration === 'active' || team.registration === 'override') {
                if (registrationStatus !== 'active')
                    registrationStatus = team.registration;
            }

            if (team.schedule === 'active' || team.schedule === 'override') {
                if (scheduleStatus !== 'active')
                    scheduleStatus = team.schedule;
            }
        }

        if (!!scheduleStatus) {
            const scheduleHighlight =
                scheduleStatus === 'active' && isBefore(currentTime, event.endTime);

            buttons.push(
                <Button key={`${event.slug}-schedule`} component={Link}
                        href={`/schedule/${event.slug}`}
                        color={ scheduleStatus === 'active' ? 'primary' : 'hidden' }
                        variant={ scheduleHighlight ? 'contained' : 'outlined' }>
                    {event.shortName} Volunteer Portal
                </Button>
            );
        }

        if (!!registrationStatus) {
            const registrationHighlight =
                registrationStatus === 'active' && isBefore(currentTime, event.endTime);

            buttons.push(
                <Button key={`${event.slug}-registration`} component={Link}
                        href={`/registration/${event.slug}`}
                        color={ registrationStatus === 'active' ? 'primary' : 'hidden' }
                        variant={ registrationHighlight ? 'contained' : 'outlined' }>
                    Join the {event.shortName} team!
                </Button>
            );
        }
    }

    return (
        <Grid container spacing={2} alignItems="center" sx={kStyles.landingPage}>
            <Grid size={{ xs: 12, md: 5 }}>
                <Markdown sx={{ pt: 1, px: 2 }}>
                    {props.environment.description}
                </Markdown>
                <Stack direction="column" spacing={2} sx={{ p: 2, mt: 1 }}>
                    {buttons}
                </Stack>
            </Grid>
            <Grid size={{ xs: 0, md: 7 }} sx={photoStyle} />
        </Grid>
    );
}
