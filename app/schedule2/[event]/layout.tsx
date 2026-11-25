// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import './view-transitions.css';
import { Suspense } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { AccountMenuButton } from './components/AccountMenuButton';
import { ApplicationBar } from './components/ApplicationBar';
import { DesktopNavigation } from './components/DesktopNavigation';
import { MobileNavigation } from './components/MobileNavigation';
import { ScheduleTheme } from './ScheduleTheme';
import { ScheduleTitleProvider } from './components/ScheduleTitle';
import { getAuthenticationContext } from '@lib/auth';
import { readCachedSetting } from '@lib/Settings';

import { kDefaultThemeColor, kDesktopMaximumWidthPx, kDesktopMenuWidthPx, kSheetBorderRadiusPx,
    kShellSpacingPx } from './Constants';

/**
 * Regular expression validating a 6-digit RGB hex colour string.
 */
const kHexColorRegex = /^#[0-9a-fA-F]{6}$/;

/**
 * Streams the signed-in user's avatar into `<AccountMenuButton>` behind `<Suspense>` so the static
 * App Shell prerenders without reading session cookies.
 */
async function AuthenticatedAccountMenu() {
    const { user } = await getAuthenticationContext();
    return <AccountMenuButton avatarUrl={user?.avatarUrl} userName={user?.name} />;
}

/**
 * App Shell layout for `app/schedule2/[event]/`. Renders a sticky desktop sidebar beside the pill
 * header dock and rounded content sheet on wide viewports, and an edge-to-edge top-rounded sheet
 * with floating bottom pill navigation on mobile.
 *
 * Deliberately avoids awaiting `params`, `cookies()`, `headers()`, or `@lib/Environment` so the
 * entire shell prerenders statically and navigates instantly.
 */
export default async function Schedule2Layout(props: LayoutProps<'/schedule2/[event]'>) {
    const configuredThemeColor = await readCachedSetting('theme-color', kDefaultThemeColor);
    const themeColor = kHexColorRegex.test(configuredThemeColor)
        ? configuredThemeColor
        : kDefaultThemeColor;

    return (
        <ScheduleTheme themeColor={themeColor}>
            <ScheduleTitleProvider defaultTitle="AnimeCon">
                <Stack direction="row" sx={{
                    flex: '1 1 auto',
                    gap: { md: `${kShellSpacingPx}px` },
                    marginX: 'auto',
                    maxWidth: { md: kDesktopMaximumWidthPx },
                    padding: { xs: 0, md: `${kShellSpacingPx}px` },
                    width: '100%',
                }}>
                    <Box sx={{
                        display: { xs: 'none', md: 'block' },
                        flexShrink: 0,
                        width: kDesktopMenuWidthPx,
                    }}>
                        <DesktopNavigation params={props.params} />
                    </Box>

                    <Stack direction="column" sx={{
                        flex: '1 1 auto',
                        gap: `${kShellSpacingPx}px`,
                        minWidth: 0,
                    }}>
                        <ApplicationBar
                            accountMenu={
                                <Suspense fallback={ <AccountMenuButton /> }>
                                    <AuthenticatedAccountMenu />
                                </Suspense>
                            } />
                        <Stack sx={{
                            bgcolor: 'var(--mui-palette-m3-sheet)',
                            borderRadius: {
                                xs: `${kSheetBorderRadiusPx}px ${kSheetBorderRadiusPx}px 0 0`,
                                md: `${kSheetBorderRadiusPx}px`,
                            },
                            flex: '1 1 auto',
                            gap: `${kShellSpacingPx}px`,
                            minWidth: 0,
                            padding: `${kShellSpacingPx}px`,
                            paddingBottom: {
                                xs: 'calc(80px + env(safe-area-inset-bottom, 0px))',
                                md: `${kShellSpacingPx}px`,
                            },
                        }}>
                            {props.children}
                        </Stack>
                    </Stack>
                </Stack>

                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <MobileNavigation params={props.params} />
                </Box>
            </ScheduleTitleProvider>
        </ScheduleTheme>
    );
}

export const instant = true;
export const prefetch = 'partial';
