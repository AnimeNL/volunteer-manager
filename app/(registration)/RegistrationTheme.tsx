// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { PaletteMode } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { type Theme, type ThemeOptions, ThemeProvider, createTheme, lighten } from '@mui/material/styles';
import { deepmerge } from '@mui/utils';
import { grey } from '@mui/material/colors';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Representation of the theme colours for each of the valid Palette modes.
 */
type ThemeColour = { [key in PaletteMode]: string };

/**
 * Add our own style, "hidden", which mimics disabled buttons while still allowing interaction. It
 * is used to highlight options that are only available through additional granted permissions.
 */
declare module '@mui/material/Button' {
    interface ButtonPropsColorOverrides {
        hidden: true;
    }
}

declare module '@mui/material/styles' {
    interface Palette {
        hidden: Palette['primary'];
        theme: ThemeColour;
    }

    interface PaletteOptions {
        hidden?: PaletteOptions['primary'];
        theme?: ThemeColour;
    }
}

/**
 * Default theme colours used when no environment-specific colours are available.
 */
const kDefaultThemeColours: ThemeColour = {
    dark: '#b2dfdb',
    light: '#00796b',
};

/**
 * Global cache for the Theme instances created for a given configuration.
 */
const kThemeCache = new Map<string, Theme>();

/**
 * Mixins that should be added to a created theme depending on the chosen palette mode.
 */
const kThemePaletteModeMixins: { [key in PaletteMode]: ThemeOptions } = {
    dark: {
        palette: {
            animecon: { /* empty */ } as any,  // not applicable for the registration layout
            backgroundHighlight: lighten(grey[900], .01),
            background: {
                default: '#000000',
                paper: lighten(grey[900], .01),
            },
            primaryPalette: undefined as any,
        },
    },
    light: { /* no mixins yet */ },
};

/**
 * Creates a theme for the given `themeColors` in the given `paletteMode` (and optional
 * `fontFamily`). The result of this call will be cached for the lifetime of the global environment.
 */
function createCachedTheme(
    themeColors: ThemeColour, paletteMode: PaletteMode, fontFamily?: string): Theme
{
    const themeColour = themeColors[paletteMode];
    const cacheKey = `${paletteMode}:${themeColour}:${fontFamily ?? ''}`;
    if (!kThemeCache.has(cacheKey)) {
        kThemeCache.set(cacheKey, createTheme(deepmerge(kThemePaletteModeMixins[paletteMode], {
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
                mode: paletteMode,
                primary: {
                    main: themeColour,
                },
                theme: themeColors,
                hidden: {
                    main: grey[500],
                    contrastText: '#fff',
                },
            },
            ...(fontFamily ? { typography: { fontFamily } } : {}),
        })));
    }

    return kThemeCache.get(cacheKey)!;
}

/**
 * Props accepted by the <RegistrationTheme> component.
 */
interface RegistrationThemeProps {
    /**
     * Optional font family to apply to the MUI typography configuration.
     */
    fontFamily?: string;

    /**
     * Whether dark mode should be enabled on the page. Defaults to `auto`.
     */
    paletteMode?: PaletteMode | 'auto';

    /**
     * Theme colours for the environment that's being displayed. Other colours will be computed.
     */
    themeColours?: ThemeColour;
}

/**
 * Client-side MUI theme provider for the Registration route group (and fallback error pages),
 * providing the environment-specific colour palette and CSS baseline reset.
 */
export function RegistrationTheme(props: React.PropsWithChildren<RegistrationThemeProps>) {
    const paletteMode = props.paletteMode ?? 'auto';
    const themeColours = props.themeColours ?? kDefaultThemeColours;

    const systemPrefersDarkColorScheme = useMediaQuery('(prefers-color-scheme: dark)');
    const effectiveDarkModeState: PaletteMode =
        paletteMode === 'auto' ? (systemPrefersDarkColorScheme ? 'dark' : 'light')
                               : paletteMode;

    return (
        <ThemeProvider
            theme={createCachedTheme(themeColours, effectiveDarkModeState, props.fontFamily)}>
            <CssBaseline />
            {props.children}
        </ThemeProvider>
    );
}
