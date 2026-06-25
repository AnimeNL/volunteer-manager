// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { MetadataRoute } from 'next';
import { notFound } from 'next/navigation';

import { determineEnvironment } from '@lib/Environment';
import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessList';

/**
 * Generates the Web App Manifest file for the Volunteer Manager. We'll consider both the site's
 * environment and the upcoming event in determining what to generate.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
    const authenticationContext = await getAuthenticationContext();

    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const dbInstance = db;
    const event = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventHidden.equals(/* false= */ 0))
            .and(tEvents.eventEndTime.greaterOrEqual(dbInstance.currentZonedDateTime()))
        .select({
            name: tEvents.eventShortName,
            fullName: tEvents.eventName,
        })
        .limit(1)
        .executeSelectNoneOrOne();

    const administrationShortcut: MetadataRoute.Manifest['shortcuts'] = [];
    if (authenticationContext.access.can('event.visible', { event: kAnyEvent, team: kAnyTeam })) {
        administrationShortcut.push({
            name: 'Administration',
            url: '/admin',
            icons: [
                {
                    src: '/images/icon-admin.png',
                    sizes: '192x192',
                    type: 'image/png',
                }
            ],
        });
    }

    return {
        name: event?.name || 'AnimeCon',
        short_name: event?.name || 'AnimeCon',
        description: `Volunteer Portal for ${event?.fullName || 'AnimeCon events'}`,
        start_url: '/?app',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: environment.colours.light || '#303f9f',
        icons: [
            {
                src: `/images/${environment.domain}/launchericon-512.png`,
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: `/images/${environment.domain}/launchericon-256.png`,
                sizes: '256x256',
                type: 'image/png',
            },
            {
                src: `/images/${environment.domain}/launchericon-192.png`,
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: `/images/${environment.domain}/launchericon-144.png`,
                sizes: '144x144',
                type: 'image/png',
            },
            {
                src: `/images/${environment.domain}/launchericon-96.png`,
                sizes: '96x96',
                type: 'image/png',
            },
        ],
        screenshots: [
            {
                src: '/images/screenshot-1.png',
                sizes: '586x1041',
                type: 'image/png',
            },
            {
                src: '/images/screenshot-2.png',
                sizes: '586x1041',
                type: 'image/png',
            },
            {
                src: '/images/screenshot-3.png',
                sizes: '586x1041',
                type: 'image/png',
            },
        ],
        shortcuts: [
            ...administrationShortcut,
            {
                name: 'Registration',
                url: '/hello',
                icons: [
                    {
                        src: '/images/icon-registration.png',
                        sizes: '192x192',
                        type: 'image/png',
                    }
                ],
            }
        ],
    }
}
