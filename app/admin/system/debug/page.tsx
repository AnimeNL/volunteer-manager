// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

import { DateTimePickerElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Table from '@mui/material/Table';

import { DebugOptions } from './DebugOptions';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';

import { kTemporalZonedDateTime } from '@app/api/Types';

/**
 * Zod scheme that the debug action will be validated against.
 */
const kDebugActionScheme = z.object({
    /**
     * The username submitted through the example form, required.
     */
    username: z.string().min(1, 'must have a value'),

    /**
     * Notes submitted through the example form, optional.
     */
    notes: z.string().optional(),

    /**
     * Date and time included in the example form.
     */
    date: kTemporalZonedDateTime,
});

/**
 * Refresh counter showing how often the <DebugPage> component has ran.
 */
let globalRefreshCounter = 0;

/**
 * Server action that will be invoked when the form section demo has been submitted. Reflects the
 * submitted data back to the client after a slight delay.
 */
async function debugAction(formData: unknown) {
    'use server';
    return executeServerAction(formData, kDebugActionScheme, async (data, props) => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { success: true, refresh: true };
    });
}

/**
 * The debug page displays debugging information regarding NextJS and AnimeCon Volunteer Manager
 * internals that we'd like to see in production, but don't really know how to.
 */
export default async function DebugPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals',
    });

    const debugValues: Record<string, any> = {};
    debugValues['Cookies'] = [ ...await cookies() ];
    debugValues['Headers'] = [ ...await headers() ];
    debugValues['Versions'] = process.versions;

    const values = {
        notes: `Example notes (count: ${++globalRefreshCounter})`,
        date: '2024-06-22T10:55:32Z[UTC]',
    };

    return (
        <>
            <DebugOptions />
            <FormGridSection action={debugAction} defaultValues={values} title="Form section demo"
                             timezone="Europe/Amsterdam">
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="username" label="Username" size="small" fullWidth
                                      required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="notes" label="Notes" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <DateTimePickerElement name="date" label="Date and time" required
                                           inputProps={{ size: 'small', fullWidth: true }} />
                </Grid>
            </FormGridSection>
            <Section title="Debugging information">
                <Table size="small">
                    <TableBody>
                        { Object.entries(debugValues).map(([ key, value ], index) =>
                            <TableRow key={index}>
                                <TableCell width="15%">
                                    <strong>{key}</strong>
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'pre-wrap',
                                                 overflowWrap: 'anywhere' }}>
                                    { JSON.stringify(value, undefined, /* space= */ 4) }
                                </TableCell>
                            </TableRow> )}
                    </TableBody>
                </Table>
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Debug | AnimeCon Volunteer Manager',
};
