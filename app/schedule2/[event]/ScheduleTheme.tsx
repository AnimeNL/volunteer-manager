// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Inter } from 'next/font/google';
import { useMemo } from 'react';

import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme, styled } from '@mui/material/styles';

import { type M3TonalPalette, computeM3ColorScheme } from './lib/m3ColorScheme';

import { kCardBorderRadiusPx, kSheetBorderRadiusPx } from './Constants';

declare module '@mui/material/styles' {
    interface Palette {
        m3: M3TonalPalette;
    }
    interface PaletteOptions {
        m3?: M3TonalPalette;
    }
}

/**
 * The Inter font, loaded through Next.js' font stack, matching the administration panel.
 */
const kInterFont = Inter({
    subsets: [ 'latin' ],
    display: 'swap',
    fallback: [ 'Roboto', 'Helvetica', 'Arial', 'sans-serif' ],
});

/**
 * Builds the SSR-safe Material Design 3 Expressive MUI theme configured with CSS variables and
 * `class`-based colour schemes so the App Shell prerenders cleanly on the server and pairs with
 * the root `<InitColorSchemeScript />`.
 */
function createScheduleTheme(themeColor: string) {
    const scheme = computeM3ColorScheme(themeColor);

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
                    background: {
                        default: scheme.dark.shell,
                        paper: scheme.dark.card,
                    },
                    divider: scheme.dark.outlineVariant,
                    m3: scheme.dark,
                    primary: {
                        contrastText: scheme.dark.onPrimary,
                        main: scheme.dark.primary,
                    },
                    secondary: {
                        contrastText: scheme.dark.onSecondaryContainer,
                        main: scheme.dark.secondaryContainer,
                    },
                    text: {
                        primary: scheme.dark.onSurface,
                        secondary: scheme.dark.onSurfaceVariant,
                    },
                },
            },
            light: {
                palette: {
                    background: {
                        default: scheme.light.shell,
                        paper: scheme.light.card,
                    },
                    divider: scheme.light.outlineVariant,
                    m3: scheme.light,
                    primary: {
                        contrastText: scheme.light.onPrimary,
                        main: scheme.light.primary,
                    },
                    secondary: {
                        contrastText: scheme.light.onSecondaryContainer,
                        main: scheme.light.secondaryContainer,
                    },
                    text: {
                        primary: scheme.light.onSurface,
                        secondary: scheme.light.onSurfaceVariant,
                    },
                },
            },
        },
        components: {
            MuiCard: {
                defaultProps: {
                    elevation: 0,
                },
                styleOverrides: {
                    root: ({ theme }) => ({
                        backgroundColor: (theme.vars || theme).palette.m3.card,
                        backgroundImage: 'none',
                        borderRadius: kCardBorderRadiusPx,
                    }),
                },
            },
            MuiCardContent: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        padding: theme.spacing(2),
                        '&:last-child': {
                            paddingBottom: theme.spacing(2),
                        },
                    }),
                },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: ({ theme }) => ({
                        backgroundColor: (theme.vars || theme).palette.m3.dockActive,
                        backgroundImage: 'none',
                        borderRadius: kCardBorderRadiusPx,
                        marginTop: theme.spacing(1),
                    }),
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiSkeleton: {
                styleOverrides: {
                    rounded: {
                        borderRadius: kCardBorderRadiusPx,
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paperAnchorBottom: ({ theme }) => ({
                        backgroundColor: (theme.vars || theme).palette.m3.shell,
                        backgroundImage: 'none',
                        borderTopLeftRadius: kSheetBorderRadiusPx,
                        borderTopRightRadius: kSheetBorderRadiusPx,
                    }),
                },
            },
        },
        cssVariables: {
            colorSchemeSelector: 'class',
        },
        shape: {
            borderRadius: kCardBorderRadiusPx,
        },
        typography: {
            fontFamily: kInterFont.style.fontFamily,
        },
    });
}

/**
 * Full-viewport M3 tonal shell container replacing the legacy tiled background pattern.
 */
const ScheduleBackground = styled(Box)(({ theme }) => ({
    backgroundColor: (theme.vars || theme).palette.m3.shell,
    color: (theme.vars || theme).palette.m3.onSurface,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100dvh',
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
