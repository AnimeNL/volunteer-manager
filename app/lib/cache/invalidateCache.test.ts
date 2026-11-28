// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventStateSlice, InvalidatableEventStateEntry } from './Types';
import { Cache } from './Cache';
import { expandInvalidationScopes } from './InvalidationScopes';
import { invalidateCache } from './invalidateCache';

function createMockEventStateEntry(festivalId?: number) {
    const dirtySlices: EventStateSlice[] = [];
    const dirtyVolunteers: number[] = [];
    let boundaryHoursResetCount = 0;

    const entry: InvalidatableEventStateEntry = {
        festivalId,
        markDirty: (slice) => { dirtySlices.push(slice); },
        markVolunteerDirty: (userId) => { dirtyVolunteers.push(userId); },
        resetBoundaryHours: () => { boundaryHoursResetCount++; },
    };

    return {
        entry: entry as any,
        dirtySlices,
        dirtyVolunteers,
        get boundaryHoursResetCount() { return boundaryHoursResetCount; },
    };
}

describe('invalidateCache', () => {
    beforeEach(() => {
        for (const cache of Cache.getAll())
            cache.clear();
    });

    it('expands scope implications transitively in specificity order', () => {
        expect(expandInvalidationScopes('event.slug')).toEqual([
            'event.slug',
            'event.visibility',
            'event.identity',
            'event',
        ]);
        expect(expandInvalidationScopes('event.volunteer.membership')).toEqual([
            'event.volunteer.membership',
            'event.volunteer',
            'user.auth',
        ]);
        expect(expandInvalidationScopes('user.profile')).toEqual([
            'user.profile',
            'user.auth',
        ]);
        expect(expandInvalidationScopes('team.visibility')).toEqual([
            'team.visibility',
            'team',
        ]);
    });

    it('resolves event ID and slug in memory and escalates across event scopes', () => {
        const eventCache = Cache.getInstance('EventCache');
        const slugCache = Cache.getInstance('UrlSlugs');
        const stateCache = Cache.getInstance('EventState');
        const activeEventsCache = Cache.getInstance('AdminNavigationActiveEvents');
        const menuCache = Cache.getInstance('AdminNavigationMenuCache');
        const manifestCache = Cache.getInstance('ManifestLatestEvent');
        const authCache = Cache.getInstance('Authentication');

        const seed = () => {
            eventCache.set('2026', { id: 42, slug: '2026' } as any);
            slugCache.set({ event: 42 }, '2026');
            stateCache.set(42, createMockEventStateEntry(9001).entry);
            activeEventsCache.set([ { concluded: false, label: '2026', slug: '2026' } ]);
            menuCache.set('2026', { badge: 1 });
            manifestCache.set({ name: 'AnimeCon 2026', fullName: 'AnimeCon 2026: Test' });
            authCache.set(7, { context: {} as any, sessions: new Map() });
        };

        // Plain `event` invalidates only EventCache, EventState, and UrlSlugs (resolving slug by ID).
        seed();
        invalidateCache('event', { eventId: 42 });
        expect(eventCache.has('2026')).toBe(false);
        expect(slugCache.has({ event: 42 })).toBe(false);
        expect(stateCache.has(42)).toBe(false);
        expect(activeEventsCache.has()).toBe(true);
        expect(menuCache.has('2026')).toBe(true);
        expect(manifestCache.has()).toBe(true);
        expect(authCache.has(7)).toBe(true);

        // `event.identity` also clears AdminNavigationActiveEvents and ManifestLatestEvent.
        seed();
        invalidateCache('event.identity', { eventSlug: '2026' });
        expect(eventCache.has('2026')).toBe(false);
        expect(slugCache.has({ event: 42 })).toBe(false);
        expect(stateCache.has(42)).toBe(false);
        expect(activeEventsCache.has()).toBe(false);
        expect(manifestCache.has()).toBe(false);
        expect(authCache.has(7)).toBe(true);

        // `event.visibility` also clears Authentication.
        seed();
        invalidateCache('event.visibility', { eventId: 42 });
        expect(activeEventsCache.has()).toBe(false);
        expect(manifestCache.has()).toBe(false);
        expect(authCache.has(7)).toBe(false);
        expect(menuCache.has('2026')).toBe(true);

        // `event.slug` clears AdminNavigationMenuCache and deletes both old and new slugs.
        seed();
        eventCache.set('2026-new', { id: 42, slug: '2026-new' } as any);
        invalidateCache('event.slug', {
            eventId: 42,
            eventSlug: '2026-new',
            previousSlug: '2026',
        });
        expect(eventCache.has('2026')).toBe(false);
        expect(eventCache.has('2026-new')).toBe(false);
        expect(menuCache.has('2026')).toBe(false);
        expect(authCache.has(7)).toBe(false);
    });

    it('invalidates EventState slices surgically across program, shifts, schedule, teams, roles, ' +
        'volunteers, and boundary settings', () =>
    {
        const eventA = createMockEventStateEntry(9001);
        const eventB = createMockEventStateEntry(9002);

        const stateCache = Cache.getInstance('EventState');
        stateCache.set(1, eventA.entry);
        stateCache.set(2, eventB.entry);

        invalidateCache('event.program', { festivalId: 9001 });
        expect(eventA.dirtySlices).toEqual([ 'program' ]);
        expect(eventB.dirtySlices).toEqual([]);

        const metadataCache = Cache.getInstance('PageMetadata');
        metadataCache.set({ type: 'shift', id: '99' }, 'Entrance');

        invalidateCache('event.shifts', { eventId: 1, shiftId: 99 });
        expect(metadataCache.has({ type: 'shift', id: '99' })).toBe(false);
        invalidateCache('event.schedule', { eventId: 1 });
        invalidateCache('event.teams', { eventId: 1, eventSlug: '2026' });
        expect(eventA.dirtySlices).toEqual([ 'program', 'shifts', 'schedule', 'teams' ]);

        invalidateCache('shiftCategories');
        expect(eventA.dirtySlices.at(-1)).toBe('shifts');
        expect(eventB.dirtySlices.at(-1)).toBe('shifts');

        invalidateCache('role');
        expect(eventA.dirtySlices.at(-1)).toBe('teams');
        expect(eventB.dirtySlices.at(-1)).toBe('teams');

        invalidateCache('event.volunteer', { eventId: 1, userId: 7 });
        expect(eventA.dirtyVolunteers).toEqual([ 7 ]);
        expect(eventB.dirtyVolunteers).toEqual([]);

        invalidateCache('settings', { keys: [ 'theme-color' ] });
        expect(eventA.boundaryHoursResetCount).toBe(0);

        invalidateCache('settings', { keys: [ 'schedule-event-view-start-hours' ] });
        expect(eventA.boundaryHoursResetCount).toBe(1);
        expect(eventB.boundaryHoursResetCount).toBe(1);
    });

    it('invalidates volunteer membership across both EventState and Authentication', () => {
        const eventA = createMockEventStateEntry();
        const stateCache = Cache.getInstance('EventState');
        const authCache = Cache.getInstance('Authentication');

        stateCache.set(1, eventA.entry);
        authCache.set(7, { context: {} as any, sessions: new Map() });
        authCache.set(8, { context: {} as any, sessions: new Map() });

        invalidateCache('event.volunteer.membership', { eventId: 1, userId: 7 });

        expect(eventA.dirtyVolunteers).toEqual([ 7 ]);
        expect(authCache.has(7)).toBe(false);
        expect(authCache.has(8)).toBe(true);
    });

    it('invalidates team, environment, content, vendors, tickets, user, and inbox caches', () => {
        const teamCache = Cache.getInstance('TeamCache');
        const slugCache = Cache.getInstance('UrlSlugs');
        const envCache = Cache.getInstance('Environments');
        const menuCache = Cache.getInstance('AdminNavigationMenuCache');
        const authCache = Cache.getInstance('Authentication');
        const contentCache = Cache.getInstance('Content');
        const portalCache = Cache.getInstance('VolunteerPortal');
        const ticketCache = Cache.getInstance('TicketProvider');
        const metadataCache = Cache.getInstance('PageMetadata');

        teamCache.set('crew', { id: 3, slug: 'crew' } as any);
        slugCache.set({ team: 3 }, 'crew');
        envCache.set([]);
        menuCache.set('2026', { badge: 1 });
        menuCache.set('inbox/10', []);
        menuCache.set('inbox/11', []);
        authCache.set(10, { context: {} as any, sessions: new Map() });
        authCache.set(11, { context: {} as any, sessions: new Map() });
        contentCache.set({ environment: 'team', eventId: 42, path: 'faq' }, {
            title: 'FAQ',
            content: 'Body',
        });
        portalCache.set({ eventId: 42, type: 'vendors' }, []);
        ticketCache.set('2026/weeztix', { events: [] });
        ticketCache.set('2026/weeztix/ticketTypes', { ticketTypes: [] });
        metadataCache.set({ type: 'emailAccount', id: '5' }, 'info@animecon.nl');
        metadataCache.set({ type: 'environment', id: 'animecon.team' }, 'Team');

        // Team visibility clears TeamCache, UrlSlugs, Environments, MenuCache, and Auth.
        invalidateCache('team.visibility', { teamId: 3 });
        expect(teamCache.has('crew')).toBe(false);
        expect(slugCache.has({ team: 3 })).toBe(false);
        expect(envCache.has()).toBe(false);
        expect(menuCache.has('2026')).toBe(false);
        expect(authCache.has(10)).toBe(false);

        // Content, vendors, and tickets target only their matching entries.
        invalidateCache('event.content', { eventId: 42 });
        expect(contentCache.has({ environment: 'team', eventId: 42, path: 'faq' })).toBe(false);

        invalidateCache('event.vendors', { eventId: 42 });
        expect(portalCache.has({ eventId: 42, type: 'vendors' })).toBe(false);

        invalidateCache('event.tickets', { eventSlug: '2026', target: 'weeztixTicketTypes' });
        expect(ticketCache.has('2026/weeztix')).toBe(true);
        expect(ticketCache.has('2026/weeztix/ticketTypes')).toBe(false);

        invalidateCache('event.tickets', { eventSlug: '2026', target: 'weeztix' });
        expect(ticketCache.has('2026/weeztix')).toBe(false);

        // Inbox invalidation targets a single user or all inbox/* entries plus account metadata.
        menuCache.set('inbox/10', []);
        menuCache.set('inbox/11', []);
        menuCache.set('system', { logs: 1 });

        invalidateCache('inbox', { userId: 10 });
        expect(menuCache.has('inbox/10')).toBe(false);
        expect(menuCache.has('inbox/11')).toBe(true);
        expect(menuCache.has('system')).toBe(true);

        invalidateCache('inbox', { accountId: 5 });
        expect(menuCache.has('inbox/11')).toBe(false);
        expect(menuCache.has('system')).toBe(true);
        expect(metadataCache.has({ type: 'emailAccount', id: '5' })).toBe(false);

        // Environment clears environment page metadata.
        invalidateCache('environment');
        expect(metadataCache.has({ type: 'environment', id: 'animecon.team' })).toBe(false);
    });
});
