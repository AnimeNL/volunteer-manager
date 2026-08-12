// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Table from '@mui/material/Table';
import Typography from '@mui/material/Typography';

import type { BuildUpTearDownDataExport } from '@app/api/exports/route';

/**
 * Props accepted by the <ExportBuildUpTearDown> component.
 */
interface ExportBuildUpTearDownProps {
    /**
     * The list of volunteers who are helping out with either build-up or tear-down.
     */
    buildUpTearDown: BuildUpTearDownDataExport;
}

/**
 * The <ExportBuildUpTearDownProps> component lists the volunteers who will be helping out with the
 * event's build-up or tear-down. They are ordered by server.
 */
export function ExportBuildUpTearDown(props: ExportBuildUpTearDownProps) {
    const { buildUpTearDown } = props;

    if (!Array.isArray(buildUpTearDown))
        return null;

    return (
        <Stack direction="column" spacing={2}>
            { buildUpTearDown.map((entry, index) =>
                <Paper key={index} sx={{ p: 2 }}>
                    <Typography variant="h5" sx={{ mb: 1 }}>
                        {entry.date}
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell width="5%">#</TableCell>
                                <TableCell>Availability</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Team</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { entry.volunteers.map((volunteer, index) =>
                                <TableRow key={index}>
                                    <TableCell>{ index + 1 }</TableCell>
                                    <TableCell>{volunteer.availability}</TableCell>
                                    <TableCell>{volunteer.name}</TableCell>
                                    <TableCell>{volunteer.team}</TableCell>
                                </TableRow> )}
                        </TableBody>
                    </Table>
                </Paper> )}
            { !buildUpTearDown.length &&
                <Alert severity="error">
                    There are no volunteers who are planning to help out.
                </Alert> }
        </Stack>
    );
}
