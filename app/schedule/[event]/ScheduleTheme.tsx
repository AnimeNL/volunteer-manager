// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import type { PaletteMode } from '@mui/material';
import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { decomposeColor, lighten } from '@mui/system/colorManipulator';
import useMediaQuery from '@mui/material/useMediaQuery';

import Box from '@mui/material/Box';

export interface AdminPalette {
    adminExampleBackground: string;
    adminHeaderBackground: string;
    adminSubmitBackground: string;
};

interface PublicPalette {
    activeBackground: string;
    activeBackgroundHover: string;
    pastBackground: string;
    pastBackgroundHover: string;
    pastForeground: string;
}

declare module '@mui/material/styles' {
    interface Components {
        acThemeDarkColor: string;
        acThemeLightColor: string;
    }
    interface Palette {
        animecon: AdminPalette & PublicPalette;
    }
    interface PaletteOptions {
        animecon: AdminPalette & PublicPalette;
    }
}

/**
 * Palette mode that the schedule app can be in. Extends the regular MUI palette.
 */
type SchedulePaletteMode = PaletteMode | 'auto';

/**
 * Data stored within the theme context.
 */
export interface ScheduleThemeContextInfo {
    /**
     * Whether the schedule app should be in dark mode, light mode, or be inferred.
     */
    mode: SchedulePaletteMode;

    /**
     * Updates the palette mode for the schedule. Will persist between page loads for the local
     * client, but not across clients for the same user.
     */
    updateMode?: (mode: SchedulePaletteMode) => void;
}

/**
 * The <ScheduleThemeContext> carries information about the theme that can be accessed and
 * manipulated throughout the volunteer portal.
 */
export const ScheduleThemeContext = createContext<ScheduleThemeContextInfo>({
    mode: 'auto',
});

/**
 * Cache key in the local storage in which we'll store the configured palette mode.
 */
const kCacheKey = 'acPalette';

/**
 * Styling rules for the <ScheduleTheme> component & hierarchy.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        minHeight: '100vh',
        paddingBottom: {
            xs: 6,  // height of the mobile navigation bar
            md: 1,  // single spacing
        },

        backgroundColor: 'background.default',
        backgroundImage: theme => `url(/images/schedule/background-${theme.palette.mode}.png)`,

        colorScheme: 'light only',
    },
};

/**
 * Reads the palette mode from local cache, or `auto` as the default value when none has been set.
 */
function readPaletteModeFromCache(): SchedulePaletteMode {
    if (typeof globalThis.localStorage === 'undefined')
        return 'auto';   // bail out for server-side rendering

    try {
        const paletteMode = localStorage.getItem(kCacheKey);
        switch (paletteMode) {
            case 'light':
            case 'dark':
                return paletteMode;
        }
    } finally { /* nothing to do */ }

    return 'auto';
}

/**
 * Stores the given `mode` as the locally cached palette mode. It's not clear whether the try/catch
 * is necessary here, it's added due to historic trauma with Private Mode in iOS Safari.
 */
function storePaletteModeToCache(mode: SchedulePaletteMode) {
    try {
        switch (mode) {
            case 'light':
            case 'dark':
                localStorage.setItem(kCacheKey, mode);
                break;

            default:
                localStorage.removeItem(kCacheKey);
                break;
        }
    } finally { /* nothing to do */ }
}

/**
 * Creates the theme for the schedule environment for the given colour scheme (`mode`) and base
 * colour (`base`). The rest of the scheme will be computed based on that.
 */
function createScheduleTheme(mode: PaletteMode, palette: { dark: string; light: string }) {
    const main = palette[mode];

    // MUI's `decomposeColor` is idempotent, and caching the decomposed colour avoids a series of
    // repeated string parsing that would have to happen on every page load.
    const baseColour = decomposeColor(main) as unknown as string;

    return createTheme({
        breakpoints: {
            values: {
                xs: 0,
                sm: 600,
                md: 840,
                lg: 1200,
                xl: 1536,
            },
        },
        palette: {
            mode,
            animecon: {
                activeBackground: mode === 'dark' ? '#144618' : '#edf7ed',
                activeBackgroundHover: mode === 'dark' ? '#15581a' : '#dbeddb',
                pastBackground: mode === 'dark' ? '#212121' : '#e0e0e0',
                pastBackgroundHover: mode === 'dark' ? '#292929' : '#d8d8d8',
                pastForeground: mode === 'dark' ? 'rgba(255, 255, 255, .7)' : 'rgba(0, 0, 0, .25)',
            } satisfies PublicPalette as any,
            background: {
                default: mode === 'dark' ? '#181818' : lighten(baseColour, 0.94),
                paper: mode === 'dark' ? '#212121' : '#ffffff',
            },
            primary: {
                main,
            },
        },
        components: {
            acThemeDarkColor: palette.dark,
            acThemeLightColor: palette.light,

            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundColor: mode === 'dark' ? palette.light : palette.light,
                        backgroundImage: 'unset',
                    },
                },
            },
        },
    });
}

/**
 * Props accepted by the <ScheduleTheme> component.
 */
interface ScheduleThemeProps {
    /**
     * Base colours, as an RGB hex colour, based on which the theme should be computed. Colours for
     * light and dark mode must be specified separately.
     */
    palette: {
        dark: string;
        light: string;
    },
}

/**
 * The <ScheduleTheme> component modifies the global theme with colours specific to the schedule,
 * which has a slightly different configuration from the registration app.
 */
export function ScheduleTheme(props: React.PropsWithChildren<ScheduleThemeProps>) {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    const [ mode, setMode ] = useState<SchedulePaletteMode>(() => readPaletteModeFromCache());

    const updateMode = useCallback((mode: SchedulePaletteMode) => {
        storePaletteModeToCache(mode);
        setMode(mode);
    }, [ /* no deps */ ]);

    const context = useMemo((): ScheduleThemeContextInfo => {
        return { mode, updateMode };
    }, [ mode, updateMode ]);

    const theme = useMemo(() => {
        switch (mode) {
            case 'light':
            case 'dark':
                return createScheduleTheme(mode, props.palette);

            default:
                return createScheduleTheme(!!prefersDarkMode ? 'dark' : 'light', props.palette);
        }
    }, [ mode, prefersDarkMode, props.palette ]);

    // ---------------------------------------------------------------------------------------------

    const [ isClient, setIsClient ] = useState<boolean>(false);
    useEffect(() => setIsClient(true), [ /* no deps */ ]);

    // Don't prerender or preset the theme on the server; Next.js does an honest attempt, but the
    // server has no way of knowing the client's dark mode preferences.
    if (!isClient)
        return undefined;

    return (
        <ScheduleThemeContext.Provider value={context}>
            <ThemeProvider theme={theme}>
                <Box sx={kStyles.container}>
                    {props.children}
                </Box>
            </ThemeProvider>
        </ScheduleThemeContext.Provider>
    );
}
