// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { Theme } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';

import type { AdminPalette } from '@app/schedule/[event]/ScheduleTheme';

/**
 * Cached version of the theme to use for the administration area.
 */
let globalAdminTheme: Theme | undefined;

/**
 * Returns the theme to use in the administrative area.
 */
export function createAdminTheme(palette: { dark: string; light: string }) {
    if (!globalAdminTheme) {
        globalAdminTheme = createTheme({
            palette: {
                mode: 'light',

                animecon: {
                    adminExampleBackground: '#eeeeee',
                    adminHeaderBackground: '#37474F',
                } satisfies AdminPalette as any,

                background: {
                    default: '#f8faf0',
                },

                primaryPalette: undefined as any,
                primary: {
                    main: '#37474F',
                },

                secondary: {
                    main: palette.light,
                },

                DataGrid: {
                    bg: 'transparent',
                },
            } as any
        });
    }

    return globalAdminTheme;
}
