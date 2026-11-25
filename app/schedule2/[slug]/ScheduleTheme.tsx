// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Inter } from 'next/font/google';
import { useMemo } from 'react';

import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme, getLuminance, lighten, styled } from '@mui/material/styles';

/**
 * The Inter font, loaded through Next.js' font stack, matching the administration panel.
 */
const kInterFont = Inter({
    subsets: [ 'latin' ],
    display: 'swap',
    fallback: [ 'Roboto', 'Helvetica', 'Arial', 'sans-serif' ],
});

/**
 * Builds the SSR-safe MUI theme configured with CSS variables and `class`-based colour schemes so
 * the App Shell prerenders cleanly on the server and pairs with the root `<InitColorSchemeScript />`.
 */
function createScheduleTheme(themeColor: string) {
    const appBarTextColor = getLuminance(themeColor) > 0.5 ? 'rgba(0, 0, 0, 0.87)' : '#ffffff';

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
        colorSchemes: {
            dark: {
                palette: {
                    AppBar: {
                        darkBg: themeColor,
                        darkColor: appBarTextColor,
                    },
                    background: {
                        default: '#181818',
                        paper: '#212121',
                    },
                    primary: {
                        main: lighten(themeColor, 0.3),
                    },
                } as any,
            },
            light: {
                palette: {
                    background: {
                        default: lighten(themeColor, 0.94),
                        paper: '#ffffff',
                    },
                    primary: {
                        main: themeColor,
                    },
                } as any,
            },
        },
        components: {
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundColor: themeColor,
                        backgroundImage: 'unset',
                        color: appBarTextColor,
                    },
                },
            },
        } as any,
        cssVariables: {
            colorSchemeSelector: 'class',
        },
        shape: {
            borderRadius: 12,
        },
        typography: {
            fontFamily: kInterFont.style.fontFamily,
        },
    });
}

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
 * Props accepted by the <ScheduleTheme> component.
 */
interface ScheduleThemeProps {
    /**
     * Primary hex colour from the `theme-color` setting used to derive light and dark palettes.
     */
    themeColor: string;
}

/**
 * Provides the SSR-safe MUI theme and background container for the `app/schedule2/` App Shell.
 */
export function ScheduleTheme(props: React.PropsWithChildren<ScheduleThemeProps>) {
    const theme = useMemo(() => createScheduleTheme(props.themeColor), [ props.themeColor ]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ScheduleBackground>
                {props.children}
            </ScheduleBackground>
        </ThemeProvider>
    );
}
