// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { ColorPalette } from './layout/ThemeUtilities';
import { AdminClientContext, type TAdminClientContext } from './AdminClientContext';
import { ThemeProvider } from './layout/ThemeProvider';
import { dayjs } from '@lib/DateTime';

/**
 * Props accepted by the <AdminClientContextProvider> component.
 */
interface AdminClientContextProviderProps {
    /**
     * Context that should be provided to all systems part of the administration area.
     */
    context: Omit<TAdminClientContext, 'isMobile'>;
}

/**
 * Provides the admin client context inside <ThemeProvider> so `useMediaQuery` reads the admin
 * theme's breakpoints rather than requiring a parent theme.
 */
function AdminClientContextProvider(
    props: React.PropsWithChildren<AdminClientContextProviderProps>)
{
    const isMobile = useMediaQuery(theme => theme.breakpoints.down('md'));
    return (
        <AdminClientContext.Provider value={{ ...props.context, isMobile }}>
            {props.children}
        </AdminClientContext.Provider>
    );
}

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
    return (
        <ThemeProvider palette={props.palette}>
            <AdminClientContextProvider context={props.context}>
                <LocalizationProvider dateAdapter={AdapterDayjs} dateLibInstance={dayjs}>
                    <NuqsAdapter>
                        {props.children}
                    </NuqsAdapter>
                </LocalizationProvider>
            </AdminClientContextProvider>
        </ThemeProvider>
    );
}
