// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Roboto } from 'next/font/google';

import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme, lighten, styled } from '@mui/material/styles';

import { kDefaultThemePalette } from './Constants';

/**
 * The Roboto font, loaded through Next.js' font stack, matching the legacy schedule portal.
 */
const kFontRoboto = Roboto({
    weight: [ '300', '400', '500', '700' ],
    subsets: [ 'latin' ],
    display: 'block',
    fallback: [ 'Helvetica', 'Arial', 'sans-serif' ],
});

/**
 * Static MUI theme configured with CSS variables and `class`-based colour schemes so the App Shell
 * prerenders cleanly on the server and pairs with the root `<InitColorSchemeScript />`.
 */
const kScheduleTheme = createTheme({
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 840,
            lg: 1200,
            xl: 1536,
        },
    },
    colorSchemes: {
        dark: {
            palette: {
                AppBar: {
                    darkBg: kDefaultThemePalette.light,
                    darkColor: '#ffffff',
                },
                background: {
                    default: '#181818',
                    paper: '#212121',
                },
                primary: {
                    main: kDefaultThemePalette.dark,
                },
            } as any,
        },
        light: {
            palette: {
                background: {
                    default: lighten(kDefaultThemePalette.light, 0.94),
                    paper: '#ffffff',
                },
                primary: {
                    main: kDefaultThemePalette.light,
                },
            } as any,
        },
    },
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: kDefaultThemePalette.light,
                    backgroundImage: 'unset',
                },
            },
        },
    } as any,
    cssVariables: {
        colorSchemeSelector: 'class',
    },
    typography: {
        fontFamily: kFontRoboto.style.fontFamily,
    },
});

/**
 * Full-viewport background container that matches the legacy schedule portal's tiled pattern and
 * bottom padding for the mobile navigation bar, switching seamlessly with CSS colour schemes.
 */
const ScheduleBackground = styled(Box)(({ theme }) => ({
    minHeight: '100vh',
    paddingBottom: theme.spacing(6),
    backgroundColor: (theme.vars || theme).palette.background.default,
    backgroundImage: 'url(/images/schedule/background-light.png)',

    [theme.breakpoints.up('md')]: {
        paddingBottom: theme.spacing(1),
    },

    ...theme.applyStyles('dark', {
        backgroundImage: 'url(/images/schedule/background-dark.png)',
    }),
}));

/**
 * Provides the SSR-safe MUI theme and background container for the `app/schedule2/` App Shell.
 */
export function ScheduleTheme(props: React.PropsWithChildren) {
    return (
        <ThemeProvider theme={kScheduleTheme}>
            <CssBaseline />
            <ScheduleBackground>
                {props.children}
            </ScheduleBackground>
        </ThemeProvider>
    );
}
