// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import db, { tEvents, tTeams } from '@lib/database';

/**
 * Zod transformer that takes a URL-safe event slug and transforms it to a representation of that
 * event from the database. A `notFound()` exception will be thrown when the `event` is not valid.
 */
export const kEventTransformer = z.string().transform(async event => {
    const eventInfo = await db.selectFrom(tEvents)
        .where(tEvents.eventSlug.equals(event))
        .select({
            id: tEvents.eventId,
            slug: tEvents.eventSlug,
            festivalId: tEvents.eventFestivalId,
        })
        .executeSelectNoneOrOne();

    if (!eventInfo)
        notFound();

    return eventInfo;
});

/**
 * Zod transformer that takes a URL-safe team slug and transforms it to a representation of that
 * team from the database. A `notFound()` exception will be thrown when the `team` is not valid.
 */
export const kTeamTransformer = z.string().transform(async team => {
    const teamInfo = await db.selectFrom(tTeams)
        .where(tTeams.teamSlug.equals(team))
        .select({
            id: tTeams.teamId,
            slug: tTeams.teamSlug,
        })
        .executeSelectNoneOrOne();

    if (!teamInfo)
        notFound();

    return teamInfo;
});
