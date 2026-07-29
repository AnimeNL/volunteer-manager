// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { PaletteMode } from '@mui/material';
import { Roboto } from 'next/font/google';
import { type Theme, type ThemeOptions, createTheme, lighten } from '@mui/material/styles';
import { deepmerge } from '@mui/utils';
import { grey } from '@mui/material/colors';

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
 * The Roboto font, loaded through NextJS' font stack, with default settings for Material UI.
 */
const kFontRoboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    display: 'block',
    fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

/**
 * Global cache for the Theme instances created for a given configuration.
 */
const kThemeCache = new Map<string, Theme>();

/**
 * Mixins that should be added to a created type depending on the chosen palette mode.
 */
const kThemePaletteModeMixins: { [key in PaletteMode]: ThemeOptions } = {
    dark: {
        palette: {
            animecon: { /* empty */ } as any,  // not applicable for the welcome layout
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
 * Creates a theme for the given |themeColors| in the given |paletteMode|. The result of this call
 * will be cached for the lifetime of the global environment.
 */
export function createCachedTheme(themeColors: ThemeColour, paletteMode: PaletteMode): Theme {
    const themeColour = themeColors[paletteMode];
    if (!kThemeCache.has(themeColour)) {
        kThemeCache.set(themeColour, createTheme(deepmerge(kThemePaletteModeMixins[paletteMode], {
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
            typography: {
                fontFamily: kFontRoboto.style.fontFamily,
            },
        })));
    }

    return kThemeCache.get(themeColour)!;
}
