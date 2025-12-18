// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound, unauthorized } from 'next/navigation';

import { determineEnvironment } from '@lib/Environment';
import { getEnvironmentContext, type EnvironmentContext } from '@lib/EnvironmentContext';
import type { ParamMap } from '../../../../../.next/types/routes';

/**
 * Type that defines the properties available on an application context.
 */
type ApplicationContext = EnvironmentContext & {
    /**
     * Information about the applicable application that the visitor has for this event + team pair.
     */
    application: EnvironmentContext['events'][number]['applications'][number];

    /**
     * Information about the event the application has been made for.
     */
    event: EnvironmentContext['events'][number];

    /**
     * Information about the team the application has been made for.
     */
    team: EnvironmentContext['events'][number]['teams'][number];

    /**
     * The visitor, which by this time will always have identified to their account.
     */
    user: NonNullable<EnvironmentContext['user']>;
};

/**
 * Gathers and returns context associated with a particular event and application, and raises the
 * appropriate HTTP errors when access issues are found.
 */
export async function getApplicationContext<
    T extends { params: Promise<ParamMap['/registration/[slug]/application/[team]']> }>(props: T)
        : Promise<ApplicationContext>
{
    const environment = await determineEnvironment();
    if (!environment)
        notFound();  // the page is loaded for an invalid environment

    const params = await props.params;

    const context = await getEnvironmentContext(environment);

    const event = context.events.find(event => event.slug === params.slug);
    if (!event)
        notFound();  // the page is loaded for an invalid event

    const team = event.teams.find(team => team.slug === params.team);
    if (!team)
        notFound();  // the page is loaded for an invalid team

    if (!context.user)
        unauthorized();  // the visitor isn't signed in to their account

    const application = event.applications.find(application => application.team === params.team);
    if (!application)
        forbidden();  // the visitor hasn't made an application to this event and/or team

    return {
        ...context,
        application,
        event,
        team,
        user: context.user,
    };
}
