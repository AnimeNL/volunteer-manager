// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { PaletteMode } from '@mui/material';
import type { Theme, ThemeOptions } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { deepmerge } from '@mui/utils';
import { grey } from '@mui/material/colors';

import type { AdminPalette } from '@app/schedule/[event]/ScheduleTheme';

/**
 * Mixins that should be added to a created type depending on the chosen palette mode.
 */
const kThemePaletteModeMixins: { [key in PaletteMode]: ThemeOptions } = {
    dark: {
        palette: {
            animecon: {
                adminExampleBackground: '#212121',
                adminHeaderBackground: '#0d419d',
                adminSubmitBackground: '#343125',
            } satisfies AdminPalette as any,

            primary: {
                main: '#388bfd',
            },

            background: {
                default: '#111111',
                paper: grey[900],
            },
        },
    },
    light: {
        palette: {
            animecon: {
                adminExampleBackground: '#eeeeee',
                adminHeaderBackground: '#37474F',
                adminSubmitBackground: '#fff4e5',
            } satisfies AdminPalette as any,

            primary: {
                main: '#37474F',
            },

            background: {
                default: '#f8faf0',
            },
        },
    },
};

/**
 * Cached version of the theme to use for the administration area.
 */
let globalAdminTheme: Theme | undefined;

/**
 * Returns the theme to use in the administrative area.
 */
export function createAdminTheme(mode: PaletteMode, palette: { dark: string; light: string }) {
    if (!globalAdminTheme || globalAdminTheme.palette.mode !== mode) {
        globalAdminTheme = createTheme(deepmerge(kThemePaletteModeMixins[mode], {
            palette: {
                mode,

                secondary: {
                    main: palette[mode],
                },

                DataGrid: {
                    bg: 'transparent',
                },
            }
        }));
    }

    return globalAdminTheme;
}
