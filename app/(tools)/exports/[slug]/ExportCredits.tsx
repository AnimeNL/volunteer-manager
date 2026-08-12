// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { FormContainer, TextareaAutosizeElement } from '@proxy/react-hook-form-mui';
import { useMemo } from 'react';

import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Table from '@mui/material/Table';

import type { CreditsDataExport } from '@app/api/exports/route';

/**
 * Props accepted by the <ExportCredits> component.
 */
interface ExportCreditsProps {
    /**
     * The credit data export that should be rendered by this component.
     */
    credits: CreditsDataExport;
}

/**
 * The <ExportCredits> component lists the volunteers who want their name to be included in the
 * credit reel, as well as the volunteers who decidedly do not want their name to be included.
 */
export function ExportCredits(props: ExportCreditsProps) {
    const { credits } = props;

    const defaultValues = useMemo(() => {
        const defaultValues: Record<string, string> = {};
        if (credits && credits.declined.length)
            defaultValues['declined'] = credits.declined.join(', ');

        for (const { role, volunteers } of credits.included)
            defaultValues[role] = volunteers.join(', ');

        return defaultValues;

    }, [ credits ]);

    return (
        <FormContainer defaultValues={defaultValues}>
            <Stack direction="column" spacing={2}>
                { credits && credits.declined.length > 0 &&
                    <Paper sx={{ p: 2 }}>
                        <Alert severity="error" sx={{ mb: 2 }}>
                            The following volunteers do <strong>not</strong> want to be included.
                        </Alert>
                        <TextareaAutosizeElement fullWidth size="small" name="declined" />
                    </Paper> }
                { credits && credits.declined.length === 0 &&
                    <Paper sx={{ p: 2 }}>
                        <Alert severity="success">
                            All our volunteers have consented to being included in the credit reel!
                        </Alert>
                    </Paper> }
                { credits && credits.included.length > 0 &&
                    <Paper sx={{ p: 2 }}>
                        <Alert severity="info" sx={{ mb: 1 }}>
                            The following volunteers <strong>do</strong> want to be included. This
                            list is for your information—AnPlan should be considered leading.
                        </Alert>
                        <Table size="small">
                            <TableBody>
                                { credits.included.map(({ role, volunteers }, index) =>
                                    <TableRow key={index}>
                                        <TableCell variant="head" width="25%">
                                            {role}
                                        </TableCell>
                                        <TableCell>
                                            <TextareaAutosizeElement fullWidth size="small"
                                                                     name={role} />
                                        </TableCell>
                                    </TableRow> )}
                            </TableBody>
                        </Table>
                    </Paper> }
            </Stack>
        </FormContainer>
    );
}
