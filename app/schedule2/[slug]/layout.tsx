// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import './view-transitions.css';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { ApplicationBar } from './components/ApplicationBar';
import { DesktopNavigation } from './components/DesktopNavigation';
import { MobileNavigation } from './components/MobileNavigation';
import { ScheduleTheme } from './ScheduleTheme';
import { ScheduleTitleProvider } from './components/ScheduleTitle';
import { readCachedSetting } from '@lib/Settings';

import { kDefaultThemeColor, kDesktopMaximumWidthPx, kDesktopMenuWidthPx } from './Constants';

/**
 * Regular expression validating a 6-digit RGB hex colour string.
 */
const kHexColorRegex = /^#[0-9a-fA-F]{6}$/;

/**
 * App Shell layout for `app/schedule2/[slug]/`. Deliberately avoids awaiting `params`, `cookies()`,
 * `headers()`, or `@lib/Environment` so the entire shell prerenders statically and navigates
 * instantly.
 */
export default async function Schedule2Layout(props: LayoutProps<'/schedule2/[slug]'>) {
    const configuredThemeColor = await readCachedSetting('theme-color', kDefaultThemeColor);
    const themeColor = kHexColorRegex.test(configuredThemeColor)
        ? configuredThemeColor
        : kDefaultThemeColor;

    return (
        <ScheduleTheme themeColor={themeColor}>
            <ScheduleTitleProvider defaultTitle="AnimeCon">
                <ApplicationBar />
                <Stack direction="row" sx={{
                    margin: 'auto',
                    maxWidth: { md: kDesktopMaximumWidthPx },
                    paddingRight: { md: 1.5 },
                }}>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <DesktopNavigation params={props.params} />
                    </Box>
                    <Stack direction="column" spacing={1.5} sx={{
                        flexGrow: 1,
                        maxWidth: '100%',
                        width: { md: `calc(100% - ${2 * kDesktopMenuWidthPx}px)` },
                        padding: 1.5,
                    }}>
                        {props.children}
                    </Stack>
                </Stack>
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <MobileNavigation />
                </Box>
            </ScheduleTitleProvider>
        </ScheduleTheme>
    );
}

export const instant = true;
export const prefetch = 'partial';
