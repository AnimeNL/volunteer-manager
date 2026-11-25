// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import './view-transitions.css';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { ApplicationBar } from './components/ApplicationBar';
import { DesktopNavigation } from './components/DesktopNavigation';
import { MobileNavigation } from './components/MobileNavigation';
import { ScheduleTheme } from './ScheduleTheme';

import { kDesktopMaximumWidthPx, kDesktopMenuWidthPx } from './Constants';

/**
 * Opt into Next.js Instant Navigation validation and Partial Prefetching for `app/schedule2/`.
 */
export const instant = true;
export const prefetch = 'partial';

/**
 * Styling rules for the <Schedule2Layout> App Shell, matching the legacy schedule layout.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        margin: 'auto',
        maxWidth: {
            md: kDesktopMaximumWidthPx,
        },
        paddingRight: {
            md: 2,
        },
    },

    content: {
        flexGrow: 1,
        maxWidth: '100%',
        width: {
            md: `calc(100% - ${2 * kDesktopMenuWidthPx}px)`,
        },
        padding: 2,
    },
};

/**
 * App Shell layout for `app/schedule2/[slug]/`. Deliberately avoids awaiting `params`, `cookies()`,
 * `headers()`, or `@lib/Environment` so the entire shell prerenders statically and navigates
 * instantly.
 */
export default function Schedule2Layout(props: LayoutProps<'/schedule2/[slug]'>) {
    return (
        <ScheduleTheme>
            <ApplicationBar title="AnimeCon" />
            <Stack direction="row" sx={kStyles.container}>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                    <DesktopNavigation />
                </Box>
                <Stack direction="column" spacing={2} sx={kStyles.content}>
                    {props.children}
                </Stack>
            </Stack>
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <MobileNavigation />
            </Box>
        </ScheduleTheme>
    );
}
