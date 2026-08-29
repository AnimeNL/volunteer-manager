// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

import useMediaQuery from '@mui/material/useMediaQuery';

import type { ColorPalette } from './layout/ThemeUtilities';
import { AdminClientContext, type TAdminClientContext } from './AdminClientContext';
import { ThemeProvider } from './layout/ThemeProvider';

/**
 * Props accepted by the <AdminClientProviders> component.
 */
interface AdminClientProvidersProps {
    /**
     * Context that should be provided to all systems part of the administration area.
     */
    context: Omit<TAdminClientContext, 'isMobile'>;

    /**
     * Colour palette that should be used for the administration interface.
     */
    palette: ColorPalette;
}

/**
 * Client-side providers that need to be set as part of the administration area layout.
 */
export function AdminClientProviders(props: React.PropsWithChildren<AdminClientProvidersProps>) {
    const isMobile = useMediaQuery(theme => theme.breakpoints.down('md'));
    return (
        <ThemeProvider palette={props.palette}>
            <AdminClientContext.Provider value={{ ...props.context, isMobile }}>
                <NuqsAdapter>
                    {props.children}
                </NuqsAdapter>
            </AdminClientContext.Provider>
        </ThemeProvider>
    );
}
