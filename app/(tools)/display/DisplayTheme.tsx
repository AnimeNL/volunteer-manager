// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Inter, Open_Sans } from 'next/font/google';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';

import Box from '@mui/material/Box';

/**
 * The Open Sans font is used for headers shown on the display.
 */
const kHeaderFont = Open_Sans({
    weight: ['300'],
    subsets: ['latin'],
    display: 'block',
    fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

/**
 * The Inter font is used for other text shown on the display.
 */
const kTextFont = Inter({
    weight: ['300'],
    subsets: ['latin'],
    display: 'block',
    fallback: ['Helvetica', 'Arial', 'sans-serif'],
})

/**
 * Styling rules for the <DisplayTheme> component & hierarchy.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        backgroundColor: 'background.default',
        backgroundImage: 'linear-gradient(315deg, #0b0b0b 0%, #222222 74%)',

        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,

        // Block text selection by default. It provides a weird interaction on the devices, even
        // if it's expected when the display content is shown on a regular machine.
        userSelect: 'none',
    },
};

/**
 * Creates the theme for the Display environment.
 */
function createDisplayTheme() {
    return createTheme({
        palette: {
            mode: 'dark',
            animecon: { /* empty */ } as any,  // not applicable for the display layout
            background: {
                default: '#0b0b0b',
                paper: '#2c3339',
            },
            primaryPalette: undefined as any,
            secondary: {
                main: '#eeeeee',
            },
        },
        typography: {
            fontFamily: kTextFont.style.fontFamily,

            h1: {
                ...kHeaderFont.style,
                fontSize: '2.15rem',
            },
            h2: {
                ...kHeaderFont.style,
                fontSize: '3.6rem',
            },
            subtitle1: {
                fontSize: '1rem',
                color: '#a1a1a1',
            },
        },
    });
}

/**
 * The <DisplayTheme> component modifies the global theme with colours specific to the Display,
 * which has a static configuration regardless of environment.
 */
export function DisplayTheme(props: React.PropsWithChildren) {
    return (
        <ThemeProvider theme={createDisplayTheme()}>
            <Box sx={kStyles.container}>
                {props.children}
            </Box>
        </ThemeProvider>
    );
}
