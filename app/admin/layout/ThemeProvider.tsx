// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Inter } from 'next/font/google';
import { useMemo } from 'react';

import { ThemeProvider as MuiThemeProvider, createTheme, type Color } from '@mui/material/styles';

import { type ColorPalette } from './ThemeUtilities';

/**
 * The Inter font, loaded through NextJS' font stack, with default settings for Material UI.
 */
const kInterFont = Inter({
    weight: [ '300', '400', '500', '700' ],
    subsets: [ 'latin' ],
    display: 'block',
    fallback: [ 'Roboto', 'Helvetica', 'Arial', 'sans-serif' ],
});

/**
 * Type augmentations for additional properties we add to the default theme.
 */
declare module '@mui/material/styles' {
    interface TypeBackground {
        sidebar: string | undefined;
    }

    interface Palette {
        primaryPalette: Color;
    }

    interface PaletteOptions {
        primaryPalette: Color;
    }
}

/**
 * Props accepted by the <ThemeProvider> component.
 */
interface ThemeProviderProps {
    /**
     * Colour palette that should be used for the administration interface.
     */
    palette: ColorPalette;
}

/**
 * Provider that is able to give context to all child elements about the appearance, colours, fonts
 * and other settings associated wdith displaying this particular page.
 */
export function ThemeProvider(props: React.PropsWithChildren<ThemeProviderProps>) {
    const theme = useMemo(() => createTheme({
        colorSchemes: {
            dark: {
                palette: {
                    primary: { main: props.palette[500] },
                    primaryPalette: props.palette,
                    background: {
                        default: '#1e1e1e',
                        paper: '#272727',
                        sidebar: '#0a0a0a',
                    },
                } as any,  // fixme
            },
            light: {
                palette: {
                    primary: { main: props.palette[500] },
                    primaryPalette: props.palette,
                    background: {
                        default: '#eff3f4',
                        paper: '#ffffff',
                        sidebar: '#0a0a0a',
                    },
                } as any,  // fixme
            },
        },
        cssVariables: {
            colorSchemeSelector: 'class',
        },
        shape: {
            borderRadius: 8,
        },
        typography: {
            fontFamily: kInterFont.style.fontFamily,
        },
    }), [ /* intentionally key on the main colour= */ props.palette[500] ]);

    return (
        <MuiThemeProvider theme={theme}>
            {props.children}
        </MuiThemeProvider>
    );
}
