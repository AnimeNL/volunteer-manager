// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';

const kTheme = createTheme({
    colorSchemes: {
        dark: true,
        light: true,
    },
    cssVariables: {
        colorSchemeSelector: 'class',
    },
    shape: {
        borderRadius: 8,
    },
});

/**
 * Modern version the administration area's layout.
 */
export function AdminLayoutThemeV2(props: React.PropsWithChildren) {
    return (
        <ThemeProvider theme={kTheme}>
            {props.children}
        </ThemeProvider>
    );
}
