// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import './view-transitions.css';
import type { Viewport } from 'next';
import { Suspense } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { AccountMenuButton } from './components/AccountMenuButton';
import { ApplicationBar } from './components/ApplicationBar';
import { DesktopNavigation } from './components/DesktopNavigation';
import { MobileNavigation } from './components/MobileNavigation';
import { MuiLicense } from '@components/MuiLicense';
import { ScheduleAutoRefresh } from './components/ScheduleAutoRefresh';
import { ScheduleTheme } from './ScheduleTheme';
import { computeM3ColorScheme } from './lib/m3ColorScheme';
import { getAuthenticationContext } from '@lib/auth';
import { getScheduleAccess } from './lib/getScheduleAccess';
import { getVolunteerHotelBookings } from './lib/data/hotelData';
import { getVolunteerTicket } from './lib/data/ticketData';
import { readCachedSetting } from '@lib/Settings';

import { kDefaultCheckInRateSeconds, kDefaultThemeColor, kDesktopMenuWidthPx,
    kSheetBorderRadiusPx } from './Constants';

/**
 * Regular expression validating a 6-digit RGB hex colour string.
 */
const kHexColorRegex = /^#[0-9a-fA-F]{6}$/;

/**
 * Streams the signed-in user's avatar and event-scoped account links into `<AccountMenuButton>`
 * behind `<Suspense>` so the static App Shell prerenders without reading session cookies or
 * dynamic route params.
 */
async function AuthenticatedAccountMenu(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const access = await getScheduleAccess(eventSlug);
    const user = access?.user ?? (await getAuthenticationContext()).user;

    const [ hotelBookings, ticket ] = access
        ? await Promise.all([
            getVolunteerHotelBookings(access.event, access.user.id),
            getVolunteerTicket(access.event, access.user.id),
        ])
        : [ [], undefined ];

    const hasDevelopment =
        access?.access.can('event.settings', { event: access.event.slug }) ?? false;

    return (
        <AccountMenuButton avatarUrl={user?.avatarUrl}
                           eventSlug={access?.event.slug}
                           hasDevelopment={hasDevelopment}
                           hasHotelRoom={hotelBookings.length > 0}
                           hasTicket={!!ticket}
                           userName={user?.name} />
    );
}

/**
 * Reads and validates the cached `theme-color` setting, falling back to `kDefaultThemeColor`.
 */
async function readValidatedThemeColor(): Promise<string> {
    const configuredThemeColor = await readCachedSetting('theme-color', kDefaultThemeColor);
    return kHexColorRegex.test(configuredThemeColor)
        ? configuredThemeColor
        : kDefaultThemeColor;
}

/**
 * Generates viewport metadata matching the schedule portal's light and dark tonal shell surfaces so
 * installed PWAs tint the system status and navigation bars instead of falling back to the
 * manifest's static colour.
 */
export async function generateViewport(): Promise<Viewport> {
    const themeColor = await readValidatedThemeColor();
    const scheme = computeM3ColorScheme(themeColor);

    return {
        colorScheme: 'light dark',
        themeColor: [
            { media: '(prefers-color-scheme: dark)', color: scheme.dark.shell },
            { media: '(prefers-color-scheme: light)', color: scheme.light.shell },
        ],
    };
}

/**
 * App Shell layout for the volunteer schedule portal. Renders a sticky desktop sidebar beside the
 * pill header dock and rounded content sheet on wide viewports, and an edge-to-edge top-rounded
 * sheet with floating bottom pill navigation on mobile.
 *
 * Deliberately avoids awaiting `params`, `cookies()`, `headers()`, or `@lib/Environment` so the
 * entire shell prerenders statically and navigates instantly.
 */
export default async function ScheduleLayout(props: LayoutProps<'/schedule2/[event]'>) {
    const [ configuredCheckInRateSeconds, themeColor ] = await Promise.all([
        readCachedSetting('schedule-check-in-rate-seconds', kDefaultCheckInRateSeconds),
        readValidatedThemeColor(),
    ]);

    return (
        <ScheduleTheme themeColor={themeColor}>
            <MuiLicense />
            <ScheduleAutoRefresh intervalSeconds={configuredCheckInRateSeconds} />
            <Stack direction="row" sx={{
                flex: '1 1 auto',
                gap: { md: 1.5 },
                marginX: 'auto',
                maxWidth: { md: 1280 },
                minHeight: { xs: 0, md: 'auto' },
                padding: { xs: 0, md: 1.5 },
                width: '100%',
            }}>
                <Box sx={{
                    display: { xs: 'none', md: 'block' },
                    flexShrink: 0,
                    width: kDesktopMenuWidthPx,
                }}>
                    <DesktopNavigation params={props.params} />
                </Box>

                <Stack direction="column" spacing={1.5} sx={{
                    flex: '1 1 auto',
                    minHeight: { xs: 0, md: 'auto' },
                    minWidth: 0,
                }}>
                    <ApplicationBar
                        accountMenu={
                            <Suspense fallback={ <AccountMenuButton /> }>
                                <AuthenticatedAccountMenu params={props.params} />
                            </Suspense>
                        } />
                    <Stack component="main" spacing={1.5} useFlexGap sx={{
                        bgcolor: { xs: 'transparent', md: 'm3.sheet' },
                        borderRadius: { md: `${kSheetBorderRadiusPx}px` },
                        flex: '1 1 auto',
                        minHeight: { xs: 0, md: 'auto' },
                        minWidth: 0,
                        p: { xs: 0, md: 1.5 },
                    }}>
                        {props.children}
                    </Stack>
                </Stack>
            </Stack>

            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <MobileNavigation params={props.params} />
            </Box>
        </ScheduleTheme>
    );
}

export const instant = true;
export const prefetch = 'partial';
