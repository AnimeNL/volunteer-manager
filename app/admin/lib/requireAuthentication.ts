// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound, unauthorized } from 'next/navigation';

import type { AuthenticationContext, PermissionAccessCheck, PermissionSet,
    UserAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { type CachedEvent, type CachedTeam, getEvent, getTeam } from '@lib/cache';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessList';

/**
 * Type representing an event identifier (either numeric database ID or string slug).
 */
type EventIdentifier = number | string;

/**
 * Type representing a team identifier (either numeric database ID or string slug).
 */
type TeamIdentifier = number | string;

/**
 * Page or layout props containing an event parameter.
 */
type EventProps = { params: Promise<{ event: string; team?: string }> };

/**
 * Page or layout props containing both event and team parameters.
 */
type EventAndTeamProps = { params: Promise<{ event: string; team: string }> };

/**
 * Data returned by the `requireAuthenticationWithEvent` method.
 */
export interface UserAuthenticationContextWithEvent extends UserAuthenticationContext {
    /**
     * Information about the event that's contextual to the current request.
     */
    event: CachedEvent;
}

/**
 * Data returned by the `requireAuthenticationWithEventAndTeam` method.
 */
export interface UserAuthenticationContextWithEventAndTeam
    extends UserAuthenticationContextWithEvent
{
    /**
     * Information about the team that's contextual to the current request.
     */
    team: CachedTeam;
}

/**
 * Authenticates the user and verifies they have administrative access. Can be called with or
 * without an existing `authenticationContext` (e.g. from Server Actions).
 *
 * @example requireAuthentication()
 * @example requireAuthentication('system.internals')
 * @example requireAuthentication(props.authenticationContext, 'system.internals')
 */
export async function requireAuthentication(
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContext>;
export async function requireAuthentication(
    authenticationContext: AuthenticationContext,
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContext>;
export async function requireAuthentication(
    contextOrPermission?: AuthenticationContext | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContext>
{
    return authenticate('admin', contextOrPermission, permission);
}

/**
 * Authenticates the user and verifies they have volunteer access (participating in at least one
 * event or possessing administrative access).
 *
 * @example requireVolunteerAuthentication()
 * @example requireVolunteerAuthentication('volunteer.application')
 * @example requireVolunteerAuthentication(props.authenticationContext, 'volunteer.application')
 */
export async function requireVolunteerAuthentication(
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContext>;
export async function requireVolunteerAuthentication(
    authenticationContext: AuthenticationContext,
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContext>;
export async function requireVolunteerAuthentication(
    contextOrPermission?: AuthenticationContext | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContext>
{
    return authenticate('volunteer', contextOrPermission, permission);
}

/**
 * Internal executor for base user authentication.
 */
async function authenticate(
    role: 'admin' | 'volunteer',
    contextOrPermission?: AuthenticationContext | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContext>
{
    const context = isAuthenticationContext(contextOrPermission)
        ? contextOrPermission
        : await requireAuthenticationContext();

    if (!context.user)
        unauthorized();

    verifyAccess(role, context as UserAuthenticationContext);

    const actualPermission =
        isAuthenticationContext(contextOrPermission) ? permission : contextOrPermission;

    if (actualPermission)
        executeAccessCheck(context, actualPermission);

    return context as UserAuthenticationContext;
}

/**
 * Authenticates the user, verifies they have administrative access to the specified event, and
 * fetches the relevant cached event information. Can be called in React Server Components with page
 * `props`, or in Server Actions with an `authenticationContext` and event identifier.
 *
 * @example requireAuthenticationWithEvent(eventSlug)
 * @example requireAuthenticationWithEvent(eventSlug, 'event.settings')
 * @example requireAuthenticationWithEvent(props, 'event.settings')
 * @example requireAuthenticationWithEvent(props.authenticationContext, eventSlug, 'event.settings')
 */
export async function requireAuthenticationWithEvent(
    propsOrEvent: EventProps | EventIdentifier,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEvent>;
export async function requireAuthenticationWithEvent(
    authenticationContext: AuthenticationContext,
    eventIdentifier: EventIdentifier,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEvent>;
export async function requireAuthenticationWithEvent(
    contextOrPropsOrEvent: AuthenticationContext | EventProps | EventIdentifier,
    eventOrPermission?: EventIdentifier | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContextWithEvent>
{
    return authenticateWithEvent('admin', contextOrPropsOrEvent, eventOrPermission, permission);
}

/**
 * Authenticates the user, verifies they are participating in the specified event (or possess
 * administrative access to it), and fetches the relevant cached event information.
 *
 * @example requireVolunteerAuthenticationWithEvent(eventSlug)
 * @example requireVolunteerAuthenticationWithEvent(eventSlug, 'event.schedule.access')
 * @example requireVolunteerAuthenticationWithEvent(props, 'event.schedule.access')
 * @example requireVolunteerAuthenticationWithEvent(
 * .... props.authenticationContext, eventSlug, 'event.schedule.access')
 */
export async function requireVolunteerAuthenticationWithEvent(
    propsOrEvent: EventProps | EventIdentifier,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEvent>;
export async function requireVolunteerAuthenticationWithEvent(
    authenticationContext: AuthenticationContext,
    eventIdentifier: EventIdentifier,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEvent>;
export async function requireVolunteerAuthenticationWithEvent(
    contextOrPropsOrEvent: AuthenticationContext | EventProps | EventIdentifier,
    eventOrPermission?: EventIdentifier | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContextWithEvent>
{
    return authenticateWithEvent(
        'volunteer', contextOrPropsOrEvent, eventOrPermission, permission);
}

/**
 * Internal executor for event-scoped user authentication.
 */
async function authenticateWithEvent(
    role: 'admin' | 'volunteer',
    contextOrPropsOrEvent: AuthenticationContext | EventProps | EventIdentifier,
    eventOrPermission?: EventIdentifier | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet): Promise<UserAuthenticationContextWithEvent>
{
    let context: AuthenticationContext;
    let eventIdentifier: EventIdentifier;
    let actualPermission: PermissionAccessCheck | PermissionSet | undefined;
    let teamSlug: string | undefined;

    if (isAuthenticationContext(contextOrPropsOrEvent)) {
        context = contextOrPropsOrEvent;
        eventIdentifier = eventOrPermission as EventIdentifier;
        actualPermission = permission;
    } else {
        context = await requireAuthenticationContext();
        actualPermission = eventOrPermission as PermissionAccessCheck | PermissionSet | undefined;

        if (isPropsWithParams(contextOrPropsOrEvent)) {
            const params = await contextOrPropsOrEvent.params;
            eventIdentifier = params.event;
            teamSlug = params.team;
        } else {
            eventIdentifier = contextOrPropsOrEvent;
        }
    }

    if (!context.user)
        unauthorized();

    const event = await getEvent(eventIdentifier);
    if (!event)
        notFound();

    verifyAccess(role, context as UserAuthenticationContext, event, teamSlug);

    if (actualPermission) {
        executeAccessCheck(context, actualPermission, {
            event: event.slug,
            team: teamSlug,
        });
    }

    return { ...context, user: context.user, event };
}

/**
 * Authenticates the user, verifies they have administrative access to the specified event and team,
 * and fetches the relevant cached event and team information. Can be called in React Server
 * Components with page `props`, or in Server Actions with an `authenticationContext` and event/team
 * identifiers.
 *
 * @example requireAuthenticationWithEventAndTeam(eventSlug, teamSlug)
 * @example requireAuthenticationWithEventAndTeam(eventSlug, teamSlug, 'event.applications')
 * @example requireAuthenticationWithEventAndTeam(props, 'event.applications')
 * @example requireAuthenticationWithEventAndTeam(
 * .... props.authenticationContext, eventSlug, teamSlug, 'event.applications')
 */
export async function requireAuthenticationWithEventAndTeam(
    props: EventAndTeamProps,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>;
export async function requireAuthenticationWithEventAndTeam(
    eventIdentifier: EventIdentifier,
    teamIdentifier: TeamIdentifier,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>;
export async function requireAuthenticationWithEventAndTeam(
    authenticationContext: AuthenticationContext,
    eventIdentifier: EventIdentifier,
    teamIdentifier: TeamIdentifier,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>;
export async function requireAuthenticationWithEventAndTeam(
    contextOrPropsOrEvent: AuthenticationContext | EventAndTeamProps | EventIdentifier,
    eventOrTeamOrPermission?:
        EventIdentifier | TeamIdentifier | PermissionAccessCheck | PermissionSet,
    teamOrPermission?: TeamIdentifier | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>
{
    return authenticateWithEventAndTeam(
        'admin', contextOrPropsOrEvent, eventOrTeamOrPermission, teamOrPermission, permission);
}

/**
 * Authenticates the user, verifies they are participating in the specified event and assigned to
 * the specified team (or possess administrative access to it), and fetches the relevant cached
 * event and team information.
 *
 * @example requireVolunteerAuthenticationWithEventAndTeam(eventSlug, teamSlug)
 * @example requireVolunteerAuthenticationWithEventAndTeam(
 * .... eventSlug, teamSlug, 'event.applications')
 * @example requireVolunteerAuthenticationWithEventAndTeam(props, 'event.applications')
 * @example requireVolunteerAuthenticationWithEventAndTeam(
 * .... props.authenticationContext, eventSlug, teamSlug, 'event.applications')
 */
export async function requireVolunteerAuthenticationWithEventAndTeam(
    props: EventAndTeamProps,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>;
export async function requireVolunteerAuthenticationWithEventAndTeam(
    eventIdentifier: EventIdentifier,
    teamIdentifier: TeamIdentifier,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>;
export async function requireVolunteerAuthenticationWithEventAndTeam(
    authenticationContext: AuthenticationContext,
    eventIdentifier: EventIdentifier,
    teamIdentifier: TeamIdentifier,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>;
export async function requireVolunteerAuthenticationWithEventAndTeam(
    contextOrPropsOrEvent: AuthenticationContext | EventAndTeamProps | EventIdentifier,
    eventOrTeamOrPermission?:
        EventIdentifier | TeamIdentifier | PermissionAccessCheck | PermissionSet,
    teamOrPermission?: TeamIdentifier | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>
{
    return authenticateWithEventAndTeam(
        'volunteer', contextOrPropsOrEvent, eventOrTeamOrPermission, teamOrPermission, permission);
}

/**
 * Internal executor for event- and team-scoped user authentication.
 */
async function authenticateWithEventAndTeam(
    role: 'admin' | 'volunteer',
    contextOrPropsOrEvent: AuthenticationContext | EventAndTeamProps | EventIdentifier,
    eventOrTeamOrPermission?:
        EventIdentifier | TeamIdentifier | PermissionAccessCheck | PermissionSet,
    teamOrPermission?: TeamIdentifier | PermissionAccessCheck | PermissionSet,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>
{
    let context: AuthenticationContext;
    let eventIdentifier: EventIdentifier;
    let teamIdentifier: TeamIdentifier;
    let actualPermission: PermissionAccessCheck | PermissionSet | undefined;

    if (isAuthenticationContext(contextOrPropsOrEvent)) {
        context = contextOrPropsOrEvent;
        eventIdentifier = eventOrTeamOrPermission as EventIdentifier;
        teamIdentifier = teamOrPermission as TeamIdentifier;
        actualPermission = permission;
    } else if (isPropsWithParams(contextOrPropsOrEvent)) {
        context = await requireAuthenticationContext();
        const params = await contextOrPropsOrEvent.params;
        eventIdentifier = params.event;
        teamIdentifier = params.team;
        actualPermission =
            eventOrTeamOrPermission as PermissionAccessCheck | PermissionSet | undefined;
    } else {
        context = await requireAuthenticationContext();
        eventIdentifier = contextOrPropsOrEvent;
        teamIdentifier = eventOrTeamOrPermission as TeamIdentifier;
        actualPermission = teamOrPermission as PermissionAccessCheck | PermissionSet | undefined;
    }

    if (!context.user)
        unauthorized();

    const team = await getTeam(teamIdentifier);
    if (!team)
        notFound();

    const event = await getEvent(eventIdentifier);
    if (!event)
        notFound();

    verifyAccess(role, context as UserAuthenticationContext, event, team);

    if (actualPermission) {
        executeAccessCheck(context, actualPermission, {
            event: event.slug,
            team: team.slug,
        });
    }

    return { ...context, user: context.user, event, team };
}

/**
 * Shared access verification for administrative or volunteer roles.
 */
function verifyAccess(
    role: 'admin' | 'volunteer',
    context: UserAuthenticationContext,
    event?: CachedEvent,
    team?: CachedTeam | string): void | never
{
    const teamSlug = typeof team === 'string' ? team : team?.slug;
    const hasAdminAccess = context.access.can('event.visible', {
        event: event?.slug ?? kAnyEvent,
        team: teamSlug ?? kAnyTeam,
    });

    if (role === 'admin') {
        if (!hasAdminAccess)
            forbidden();

    } else if (!hasAdminAccess) {
        if (!event) {
            if (context.events.size === 0)
                forbidden();

        } else if (!teamSlug) {
            if (!context.events.has(event.slug))
                forbidden();

        } else {
            if (context.events.get(event.slug) !== teamSlug)
                forbidden();
        }
    }
}

/**
 * Determines whether the `candidate` is an `AuthenticationContext` object.
 */
function isAuthenticationContext(candidate: unknown): candidate is AuthenticationContext {
    return !!candidate && typeof candidate === 'object' && 'access' in candidate;
}

/**
 * Determines whether the `candidate` is a props object containing `params`.
 */
function isPropsWithParams(
    candidate: unknown): candidate is { params: Promise<Record<string, string>> }
{
    return !!candidate && typeof candidate === 'object' && 'params' in candidate;
}
