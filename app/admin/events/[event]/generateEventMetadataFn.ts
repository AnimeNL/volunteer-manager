// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import type { ParamMap } from '../../../../.next/types/routes';
import db, { tEvents } from '@lib/database';

/**
 * Cache event titles for the duration of this instance.
 */
const kTitleCache = new Map();

/**
 * Prop information necessary for the `generateMetadata()` functionality to work.
 */
type ExpectedProps = { params: Promise<ParamMap['/admin/events/[event]']> };

/**
 * Generates metadata for one of the sub-pages of a particular event based on the given `title`,
 * and the `props` which include the event's slug. Will cause a database query.
 */
async function generateMetadata<T extends ExpectedProps>(props: T, title?: string)
    : Promise<Metadata>
{
    const { event } = await props.params;

    if (event && event.length > 0 && !kTitleCache.has(event)) {
        const shortName = await db.selectFrom(tEvents)
            .selectOneColumn(tEvents.eventShortName)
            .where(tEvents.eventSlug.equals(event))
            .executeSelectNoneOrOne();

        if (shortName)
            kTitleCache.set(event, shortName);
    }

    return {
        title: [
            title,
            kTitleCache.get(event),
            'AnimeCon Volunteer Manager',

        ].filter(Boolean).join(' | '),
    };
}

/**
 * Generates a `generateMetadata` compatible-function for an event with the given `title`.
 */
export function generateEventMetadataFn(title?: string) {
    return <T extends ExpectedProps>(props: T) => generateMetadata(props, title);
}
