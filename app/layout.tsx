// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';

import { WebVitalsReporter } from './components/WebVitalsReporter';
import { readSetting } from '@lib/Settings';

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
    viewportFit: 'cover',
    width: 'device-width',
};

/**
 * Conditionally renders the <WebVitalsReporter /> component based on the runtime setting. Kept
 * behind <Suspense> so the root layout does not perform uncached I/O that blocks static shells.
 */
async function WebVitalsGate() {
    await connection();

    const webVitalsReporting = await readSetting('web-vitals-reporting');
    return webVitalsReporting ? <WebVitalsReporter /> : null;
}

/**
 * The root layout of the Volunteer Manager application. Content will be rendered in here based on
 * the path that has been requested by the client, allowing for middleware routing.
 */
export default function RootLayout(props: LayoutProps<'/'>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head />
            <body>
                <InitColorSchemeScript attribute="class" />
                <AppRouterCacheProvider>
                    {props.children}
                </AppRouterCacheProvider>
                <Suspense fallback={null}>
                    <WebVitalsGate />
                </Suspense>
                { process.env.APP_ANALYTICS === '1' &&
                    <script src="https://analytics.beverloo.com/api/script.js"
                            data-site-id="47ebe80cb1b2" defer /> }
            </body>
        </html>
    );
}
