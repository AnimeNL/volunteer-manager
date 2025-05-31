// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Grid from '@mui/material/Grid';

import type { Environment } from '@lib/Environment';
import { AdditionalEventCard } from './landing/AdditionalEventCard';
import { AdministrationCard } from './landing/AdministrationCard';
import { ApplicationProgressHeader } from './ApplicationProgressHeader';
import { EventsContent } from './landing/EventsContent';
import { NoEventsContent } from './landing/NoEventsContent';
import { RegistrationContentContainer } from '@app/registration/RegistrationContentContainer';
import { RegistrationLayout } from '@app/registration/RegistrationLayout';
import { StatisticsCard } from './landing/StatisticsCard';
import { getEnvironmentContext } from '@lib/EnvironmentContext';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessList';

/**
 * Props accepted by the <LandingPage> component.
 */
interface LandingPageProps {
    /**
     * The environment for which the landing page is being shown.
     */
    environment: Environment;
}

/**
 * The <LandingPage> component is the page that volunteers first see when they reach our site, that
 * should compel them to apply to participate if they haven't yet, and that should bring them to the
 * Volunteer Portal when they have and are participating.
 */
export async function LandingPage(props: LandingPageProps) {
    const context = await getEnvironmentContext(props.environment);

    const primaryEvents = context.events.slice(0, 2);
    const secondaryEvents = context.events.slice(2).filter(event => {
        for (const team of event.teams) {
            if (team.registration === 'active' || team.registration === 'override')
                return true;  // registration portal is available
            if (team.schedule === 'active' || team.schedule === 'override')
                return true;  // schedule portal is available
        }

        return false;
    });

    const enableAdminAccess = context.access.can('event.visible', {
        event: kAnyEvent,
        team: kAnyTeam,
    });

    return (
        <RegistrationLayout environment={props.environment}>
            <RegistrationContentContainer title={props.environment.title} user={context.user}>

                <ApplicationProgressHeader context={context} />

                { !context.events.length &&
                    <NoEventsContent environment={props.environment} /> }

                { !!context.events.length &&
                    <EventsContent environment={props.environment} events={primaryEvents} /> }

            </RegistrationContentContainer>
            <Grid container spacing={2} sx={{ mt: 2 }}>

                { enableAdminAccess &&
                    <Grid size={{ xs: 12, md: 4 }}>
                        <AdministrationCard />
                    </Grid> }

                { context.access.can('statistics.basic') &&
                    <Grid size={{ xs: 12, md: 4 }}>
                        <StatisticsCard />
                    </Grid> }

                { secondaryEvents.map(event =>
                    <Grid key={event.slug} size={{ xs: 12, md: 4 }}>
                        <AdditionalEventCard event={event} />
                    </Grid> )}

            </Grid>
        </RegistrationLayout>
    );
}
