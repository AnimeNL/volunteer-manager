// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { AccessControl } from '@lib/auth/access';
import type { CachedEvent } from '@lib/cache';
import type { User } from '@lib/auth';
import { VolunteerAccess } from './VolunteerAccess';
import { getEventState } from '@lib/event';
import { requireScheduleAccess } from '../getScheduleAccess';

/**
 * Minimal viewer and event context accepted by `getVolunteerAccess()`. Compatible with both
 * `requireScheduleAccess()` (Server Components) and `requireVolunteerAuthenticationWithEvent()`
 * (Server Actions).
 */
export interface VolunteerAccessContext {
    access: AccessControl;
    event: CachedEvent;
    user: Pick<User, 'id'>;
}

/**
 * Request-cached builder so multiple Server Components and data loaders in the same render share
 * one precomputed `VolunteerAccess` instance backed by the permanent `EventState` cache.
 */
const resolveVolunteerAccess = cache(
    async (
        event: CachedEvent,
        viewerUserId: number,
        access: AccessControl): Promise<VolunteerAccess> =>
    {
        const eventState = await getEventState(event);
        if (!eventState)
            return VolunteerAccess.empty(event.slug, viewerUserId, access);

        return VolunteerAccess.fromEventState(eventState, viewerUserId, access);
    });

/**
 * Resolves the `VolunteerAccess` deciding unit for the signed-in user in the given event. Accepts
 * either an already-authenticated context (from `requireScheduleAccess()` or a Server Action) or
 * an event slug (which authenticates via `requireScheduleAccess()`).
 */
export async function getVolunteerAccess(
    contextOrEventSlug: VolunteerAccessContext | string): Promise<VolunteerAccess>
{
    const context = typeof contextOrEventSlug === 'string'
        ? await requireScheduleAccess(contextOrEventSlug)
        : contextOrEventSlug;

    return await resolveVolunteerAccess(context.event, context.user.id, context.access);
}
