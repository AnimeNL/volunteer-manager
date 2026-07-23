// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type React from 'react';
import Link from '@app/LinkProxy';
import { redirect } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { deepmerge } from '@mui/utils';

import type { Environment } from '@lib/Environment';
import type { EnvironmentContextEventAccess } from '@lib/EnvironmentContext';
import { Markdown } from '@components/Markdown';
import { isBefore } from '@lib/Temporal';

/**
 * Manual styles that apply to the <WelcomeCard> client component.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    landingPage: {
        alignItems: 'center',
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

    /**
     * Whether to redirect the user to an active schedule when one exists.
     */
    redirectToActiveSchedule: boolean;
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
        const publishContentStatus =
            event.publishContent === 'active' || event.publishContent === 'override';
        const publishPortalStatus =
            event.publishPortal === 'active' || event.publishPortal === 'override';

        if (!!publishPortalStatus && event.hasFestivalId) {
            const portalHighlight =
                event.publishPortal === 'active' && isBefore(currentTime, event.endTime);

            if (portalHighlight && props.redirectToActiveSchedule)
                redirect(`/schedule/${event.slug}`);

            buttons.push(
                <Button key={`${event.slug}-schedule`} component={Link}
                        href={`/schedule/${event.slug}`}
                        color={ event.publishPortal === 'active' ? 'primary' : 'hidden' }
                        variant={ portalHighlight ? 'contained' : 'outlined' }>
                    {event.shortName} Volunteer Portal
                </Button>
            );
        }

        if (!!publishContentStatus) {
            const contentHighlight =
                event.publishContent === 'active' && isBefore(currentTime, event.endTime);

            buttons.push(
                <Button key={`${event.slug}-registration`} component={Link}
                        href={`/registration/${event.slug}`}
                        color={ event.publishContent === 'active' ? 'primary' : 'hidden' }
                        variant={ contentHighlight ? 'contained' : 'outlined' }>
                    Join the {event.shortName} team!
                </Button>
            );
        }
    }

    return (
        <Grid container spacing={2} sx={kStyles.landingPage}>
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
