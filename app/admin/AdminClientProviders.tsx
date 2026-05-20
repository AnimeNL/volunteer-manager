// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { ThemeProvider, type PaletteMode } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { type TAdminClientContext, AdminClientContext } from './AdminClientContext';
import { createAdminTheme } from './AdminClientTheme';

/**
 * Props accepted by the <AdminClientProviders> component.
 */
interface AdminClientProvidersProps {
    /**
     * Context that should be provided to all systems part of the administration area.
     */
    context: Omit<TAdminClientContext, 'isMobile'>;

    /**
     * Whether to enable responsive layout capabilities throughout the administration area.
     */
    enableResponsiveLayout?: boolean;

    /**
     * Palette mode that should be active for the admin area.
     */
    paletteMode: PaletteMode;

    /**
     * Palette that should be used as the primary colours in the admin area.
     */
    palette: {
        dark: string;
        light: string;
    };
}

/**
 * Client-side providers that need to be set as part of the administration area layout.
 */
export function AdminClientProviders(props: React.PropsWithChildren<AdminClientProvidersProps>) {
    const isMobile =
        !!props.enableResponsiveLayout &&
        // biome-ignore lint/correctness/useHookAtTopLevel: intentional violation
        useMediaQuery(theme => theme.breakpoints.down('md'));

    return (
        <ThemeProvider theme={createAdminTheme(props.paletteMode, props.palette)}>
            <AdminClientContext.Provider value={{ ...props.context, isMobile }}>
                <NuqsAdapter>
                    {props.children}
                </NuqsAdapter>
            </AdminClientContext.Provider>
        </ThemeProvider>
    );
}
