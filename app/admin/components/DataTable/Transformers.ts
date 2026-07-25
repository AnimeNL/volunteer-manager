// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { getEvent, getTeam } from '@lib/cache';

/**
 * Zod transformer that takes a URL-safe event slug or a unique event ID and transforms it to a
 * representation of that event from the database. The returned data will be aggressively cached.
 * A `notFound()` exception will be thrown when the `event` is not valid.
 */
export const kEventTransformer = (z.string().or(z.number())).transform(async event => {
    const eventInfo = await getEvent(event);
    if (!eventInfo)
        notFound();

    return eventInfo;
});

/**
 * Zod transformer that takes a URL-safe team slug or a unique team ID and transforms it to a
 * representation of that team from the database. The returned data will be aggressively cached. A
 * `notFound()` exception will be thrown when the `team` is not valid.
 */
export const kTeamTransformer = z.string().transform(async team => {
    const teamInfo = await getTeam(team);
    if (!teamInfo)
        notFound();

    return teamInfo;
});
