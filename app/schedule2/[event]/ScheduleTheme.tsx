// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Inter } from 'next/font/google';
import { useMemo } from 'react';

import type { Components, PaletteOptions, Theme } from '@mui/material/styles';
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
 * Props accepted by the <ScheduleTheme> component.
 */
interface ScheduleThemeProps {
    /**
     * Primary hex colour from the `theme-color` setting used to derive light and dark palettes.
     */
    themeColor: string;
}

/**
 * Provides the SSR-safe MUI theme and background container for the schedule App Shell.
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

/**
 * Maps an M3 tonal palette into a MUI color-scheme palette definition.
 */
function createSchemePalette(palette: M3TonalPalette): PaletteOptions {
    return {
        background: {
            default: palette.shell,
            paper: palette.card,
        },
        divider: palette.outlineVariant,
        m3: palette,
        primary: {
            contrastText: palette.onPrimary,
            main: palette.primary,
        },
        secondary: {
            contrastText: palette.onSecondaryContainer,
            main: palette.secondaryContainer,
        },
        text: {
            primary: palette.onSurface,
            secondary: palette.onSurfaceVariant,
        },
    } as PaletteOptions;
}

/**
 * Builds the SSR-safe Material Design 3 Expressive MUI theme configured with CSS variables and
 * `class`-based colour schemes so the App Shell prerenders cleanly on the server and pairs with
 * the root `<InitColorSchemeScript />`.
 */
function createScheduleTheme(themeColor: string) {
    const scheme = computeM3ColorScheme(themeColor);

    const components: Partial<Components<Theme>> = {
        MuiCard: {
            defaultProps: {
                elevation: 0,
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
        MuiCssBaseline: {
            styleOverrides: theme => {
                const palette = (theme.vars || theme).palette;
                return {
                    '*::-webkit-scrollbar': {
                        height: 10,
                        width: 10,
                    },
                    '*::-webkit-scrollbar-track': {
                        backgroundColor: 'transparent',
                    },
                    '*::-webkit-scrollbar-thumb': {
                        backgroundClip: 'content-box',
                        backgroundColor: palette.m3.outlineVariant,
                        border: '3px solid transparent',
                        borderRadius: 999,
                    },
                    '*::-webkit-scrollbar-thumb:hover': {
                        backgroundColor:
                            `color-mix(in srgb, ${palette.m3.onSurfaceVariant} 50%, transparent)`,
                    },
                    '*::-webkit-scrollbar-corner': {
                        backgroundColor: 'transparent',
                    },
                    '@supports not selector(::-webkit-scrollbar)': {
                        '*': {
                            scrollbarColor: `${palette.m3.outlineVariant} transparent`,
                            scrollbarWidth: 'thin',
                        },
                    },
                };
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    '&.MuiDrawer-paperAnchorBottom': {
                        backgroundColor: (theme.vars || theme).palette.background.default,
                        backgroundImage: 'none',
                        borderTopLeftRadius: kSheetBorderRadiusPx,
                        borderTopRightRadius: kSheetBorderRadiusPx,
                    },
                }),
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    backgroundColor: (theme.vars || theme).palette.m3.dock,
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
    };

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
            dark: { palette: createSchemePalette(scheme.dark) },
            light: { palette: createSchemePalette(scheme.light) },
        },
        components: components as Components<Theme>,
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
 * Full-viewport M3 tonal shell container with a subtle centred top ambient gradient that lightens
 * in dark mode and darkens in light mode via SSR-safe CSS variables.
 */
const ScheduleBackground = styled(Box)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.background.default,
        backgroundImage:
            `radial-gradient(60% 480px at 50% 0%, ${palette.m3.ambientGlow} 0%, ` +
            `${palette.m3.ambientGlowSoft} 50%, transparent 100%)`,
        backgroundRepeat: 'no-repeat',
        color: palette.text.primary,
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',

        [theme.breakpoints.up('md')]: {
            height: 'auto',
            minHeight: '100dvh',
            overflow: 'visible',
        },
    };
});
