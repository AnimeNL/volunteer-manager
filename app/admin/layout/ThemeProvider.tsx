// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Inter } from 'next/font/google';

import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';

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
}

/**
 * Theme of the administration area. All pages must support both Dark Mode and responsive display,
 * so we avoid hardcoding any colour, size or setting anywhere in our code other than this
 * particular function.
 */
const kTheme = createTheme({
    colorSchemes: {
        dark: {
            palette: {
                background: {
                    default: '#1e1e1e',
                    paper: '#272727',
                    sidebar: '#0a0a0a',
                },
            } as any,  // fixme
        },
        light: {
            palette: {
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
});

/**
 * Provider that is able to give context to all child elements about the appearance, colours, fonts
 * and other settings associated wdith displaying this particular page.
 */
export function ThemeProvider(props: React.PropsWithChildren) {
    return (
        <MuiThemeProvider theme={kTheme}>
            {props.children}
        </MuiThemeProvider>
    );
}
