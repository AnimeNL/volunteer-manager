// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { determineEnvironment } from '@lib/Environment';
import db, { tEvents } from '@lib/database';

/**
 * Cache event titles for the duration of this instance.
 */
const kTitleCache = new Map();

/**
 * Generates the page title specific to the landing page or one of the registration portal pages, in
 * which we highlight the name of the team about which the visitor is being informed.
 */
async function generateMetadata(props: LayoutProps<'/registration/[slug]'>, title?: string)
    : Promise<Metadata>
{
    const { slug } = await props.params;

    const environment = await determineEnvironment();
    const product = `AnimeCon ${environment?.title ?? 'Volunteering Teams'}`;

    if (slug && slug.length > 0 && !kTitleCache.has(slug)) {
        const event = await db.selectFrom(tEvents)
            .select({ shortName: tEvents.eventShortName })
            .where(tEvents.eventSlug.equals(slug))
            .executeSelectNoneOrOne();

        if (event)
            kTitleCache.set(slug, event.shortName);
    }

    const parts = [ product ];
    if (kTitleCache.has(slug))
        parts.unshift(kTitleCache.get(slug)!);
    if (title)
        parts.unshift(title);

    return { title: parts.join(' | ') };
}

/**
 * Generates a `generateMetadata` compatible-function for an event with the given `title`.
 */
export function generatePortalMetadataFn(title?: string) {
    return (props: LayoutProps<'/registration/[slug]'>) => generateMetadata(props, title);
}
