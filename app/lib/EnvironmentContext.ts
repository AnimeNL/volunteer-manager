// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import crypto from 'node:crypto';

import type { Environment } from './Environment';
import type { RegistrationStatus } from './database/Types';
import { Temporal, isBefore } from '@lib/Temporal';
import { getAuthenticationContext, type AuthenticationContext } from './auth/AuthenticationContext';
import db, { tEvents, tEventsTeams, tTeams, tUsersEvents } from '@lib/database';

/**
 * Status of an availability window within an event context.
 */
export type EnvironmentContextEventAvailabilityStatus =
    'future' |   // the window will open in the future
    'active' |   // the window is currently open
    'past' |     // the window has closed already
    'override';  // the window is open due to an override

/**
 * Information associated with an application the visitor may have made for a particular event.
 */
export interface EnvironmentContextApplication {
    /**
     * Name of the team that the volunteer has applied to. (E.g. "Stewards")
     */
    teamName: string;

    /**
     * URL-safe slug of the team that the volunteer has applied to. (E.g. "stewards")
     */
    team: string;

    /**
     * Status of the volunteer's application.
     */
    status: RegistrationStatus;
}

/**
 * Information associated with each event that is accessible in this environment. Personalised when
 * the visitor is signed in to an account with elevated privileges.
 */
export interface EnvironmentContextEventAccess {
    /**
     * Unique ID representing this event.
     */
    id: number;

    /**
     * URL-safe slug representing this event.
     */
    slug: string;

    /**
     * Formal name of the event, as it should be presented in titles.
     */
    name: string;

    /**
     * Short name of the event, as it should be presented in prose.
     */
    shortName: string;

    /**
     * Date and time at which the event will begin.
     */
    startTime: Temporal.ZonedDateTime;

    /**
     * Date and time at which the event will finish.
     */
    endTime: Temporal.ZonedDateTime;

    /**
     * Set of applications that exist for the user. There may be zero or more, with no upper limit
     * as environments can have any number of teams associated with them.
     */
    applications: EnvironmentContextApplication[];

    /**
     * Teams that are participating in this event for the current environment. At least one.
     */
    teams: {
        /**
         * Unique ID of the team as it has been represented in the database.
         */
        id: number;

        /**
         * Private invite key through which volunteers can directly apply to join this team.
         */
        inviteKey: string;

        /**
         * URL-safe slug representing this team.
         */
        slug: string;

        /**
         * Status of the availability window for applications for participation are accepted.
         */
        applications: EnvironmentContextEventAvailabilityStatus;

        /**
         * Status of the availability window for publication of event information.
         */
        registration: EnvironmentContextEventAvailabilityStatus;

        /**
         * Status of the availability window for publication of event schedules.
         */
        schedule: EnvironmentContextEventAvailabilityStatus;

    }[];
}

/**
 * The context associated with an environment, personalised to the signed in user, if any.
 */
export type EnvironmentContext = Omit<AuthenticationContext, 'events'> & {
    /**
     * Array of events that are accessible within this environment. An environment may have zero or
     * more accessible events.
     */
    events: EnvironmentContextEventAccess[];
};

/**
 * Loads page context for the given `environment`. This involves authenticating the user and making
 * a determination which events and team combinations are accessible to them.
 */
export async function getEnvironmentContext(environment: Environment): Promise<EnvironmentContext> {
    const authenticationContext = await getAuthenticationContext();
    const events = await determineEventAccess(environment, authenticationContext);

    return {
        ...authenticationContext,
        events,
    };
}

/**
 * Information necessary in order to determine the availability status.
 */
interface AvailabilityWindowRequest {
    /**
     * When the availability window opens, when defined.
     */
    start?: Temporal.ZonedDateTime;

    /**
     * When the availability window closes, when defined.
     */
    end?: Temporal.ZonedDateTime;

    /**
     * Whether the signed in user has been granted an override permission.
     */
    override: boolean;
}

/**
 * Returns the status of the availability window contained within the given `request`, relative to
 * the givn `currentTime`. Indeterminate statuses will be resolved based on the end time of the
 * event, automatically considering the availability window to be in the past once the event has
 * completed.  Overrides will be considered when the window is not normally opened.
 */
export function determineAvailabilityStatus(
    currentTime: Temporal.ZonedDateTime, eventEndTime: Temporal.ZonedDateTime,
    request: AvailabilityWindowRequest): EnvironmentContextEventAvailabilityStatus
{
    let statusBeforeOverride: EnvironmentContextEventAvailabilityStatus;
    if (!request.start) {
        statusBeforeOverride =
            !!request.end ? isBefore(currentTime, request.end) ? 'active' : 'past'
                          : isBefore(eventEndTime, currentTime) ? 'past' : 'future';
    } else {
        if (!request.end) {
            statusBeforeOverride =
                isBefore(currentTime, request.start)
                    ? 'future'
                    : isBefore(eventEndTime, currentTime) ? 'past' : 'active';
        } else {
            statusBeforeOverride =
                isBefore(currentTime, request.start)
                    ? isBefore(request.end, request.start) ? 'past' : 'future'
                    : isBefore(currentTime, request.end) ? 'active' : 'past';
        }
    }

    if (statusBeforeOverride !== 'active' && !!request.override)
        return 'override';

    return statusBeforeOverride;
}

/**
 * Determines the events that the visitor has access to within the given `environment`. This fetches
 * all unsuspended events, and then filters it down to those that are accessible.
 */
async function determineEventAccess(
    environment: Environment, authenticationContext: AuthenticationContext)
        : Promise<EnvironmentContextEventAccess[]>
{
    const events: EnvironmentContextEventAccess[] = [ /* no events yet */ ];
    if (!environment.teams.length)
        return events;

    const dbInstance = db;
    const applicationsJoin = dbInstance.subSelectUsing(tEvents)
        .from(tUsersEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
                .and(tTeams.teamSlug.in(environment.teams))
        .where(tUsersEvents.eventId.equals(tEvents.eventId))
            .and(tUsersEvents.userId.equals(authenticationContext.user?.id || -1))
        .select({
            teamName: tTeams.teamName,
            team: tTeams.teamSlug,
            status: tUsersEvents.registrationStatus,
        })
        .forUseAsInlineAggregatedArrayValue();

    const unfilteredEvents = await dbInstance.selectFrom(tEvents)
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.eventId.equals(tEvents.eventId))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
                .and(tTeams.teamSlug.in(environment.teams))
                .and(tTeams.teamDeleted.isNull())
        .where(tEvents.eventHidden.equals(/* false= */ 0))
        .select({
            id: tEvents.eventId,
            slug: tEvents.eventSlug,

            name: tEvents.eventName,
            shortName: tEvents.eventShortName,
            startTime: tEvents.eventStartTime,
            endTime: tEvents.eventEndTime,

            applications: applicationsJoin,

            teams: dbInstance.aggregateAsArray({
                id: tTeams.teamId,
                key: tTeams.teamInviteKey,
                slug: tTeams.teamSlug,

                applicationsWindow: {
                    start: tEventsTeams.enableApplicationsStart,
                    end: tEventsTeams.enableApplicationsEnd,
                },

                registrationWindow: {
                    start: tEventsTeams.enableRegistrationStart,
                    end: tEventsTeams.enableRegistrationEnd,
                },

                scheduleWindow: {
                    start: tEventsTeams.enableScheduleStart,
                    end: tEventsTeams.enableScheduleEnd,
                },
            }),
        })
        .groupBy(tEvents.eventId)
        .orderBy(tEvents.eventStartTime, 'desc')
        .executeSelectMany();

    const access = authenticationContext.access;
    const currentTime = Temporal.Now.zonedDateTimeISO('utc');

    for (const event of unfilteredEvents) {
        const teams: EnvironmentContextEventAccess['teams'] = [ /* no teams yet */ ];

        for (const team of event.teams) {
            const applications = determineAvailabilityStatus(currentTime, event.endTime, {
                ...team.applicationsWindow,
                override: access.can('event.visible', {
                    event: event.slug,
                    team: team.slug,
                }),
            });

            const registration = determineAvailabilityStatus(currentTime, event.endTime, {
                ...team.registrationWindow,
                override: access.can('event.visible', {
                    event: event.slug,
                    team: team.slug,
                })
            });

            const schedule = determineAvailabilityStatus(currentTime, event.endTime, {
                ...team.scheduleWindow,
                override: access.can('event.schedule.access', { event: event.slug }),
            });

            if (!applications && !registration && !schedule)
                continue;  // the |user| is not able to see any aspect of this team

            teams.push({
                id: team.id,
                slug: team.slug,

                inviteKey: generateInviteKey(event.slug, team.key),

                applications,
                registration,
                schedule,
            });
        }

        if (!teams.length)
            continue;  // the |user| is not able to see any teams within this event

        events.push({ ...event, teams });
    }

    return events;
}

/**
 * Generates a private invite key specific to the `event` and the given `key`. The result must be
 * stable and deterministic given the same input values, as it may be shared externally.
 */
export function generateInviteKey(event: string, key: string): string {
    return crypto.createHash('shake256', { outputLength: 8 })
        .update(`${event}${key}`)
        .digest('hex');
}
