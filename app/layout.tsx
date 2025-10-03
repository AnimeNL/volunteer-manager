// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata, Viewport } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

import { ClientProviders } from './ClientProviders';
import { determineEnvironment } from '@lib/Environment';

/**
 * Default metadata for the application. Any server-side page can override these values, and they
 * will be swapped out in the <head> section of the <RootLayout /> component.
 */
export const metadata: Metadata = {
    description: 'Volunteer portal for the AnimeCon conventions',
    icons: [
        {
            rel: 'icon',
            url: '/favicon.ico',
        }
    ],
    robots: 'noindex, nofollow',
    manifest: '/manifest.webmanifest',
    title: 'AnimeCon Volunteering Teams',
};

/**
 * Default viewport configuration for the application.
 */
export const viewport: Viewport = {
    // TODO: Dynamically generate the theme colour based on the environment
    colorScheme: 'only light',
    initialScale: 1,
    width: 'device-width',
};

/**
 * The root layout of the Volunteer Manager application. Content will be rendered in here based on
 * the path that has been requested by the client, allowing for middleware routing.
 */
export default async function RootLayout(props: React.PropsWithChildren) {
    const environment = await determineEnvironment();

    return (
        <html lang="en">
            <head />
            <body>
                <AppRouterCacheProvider>
                    <ClientProviders paletteMode="auto" themeColours={environment?.colours}>
                        {props.children}
                    </ClientProviders>
                </AppRouterCacheProvider>
            </body>
        </html>
    );
}
