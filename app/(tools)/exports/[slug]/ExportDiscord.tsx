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

import type { DiscordDataExport } from '@app/api/exports/route';

/**
 * Props accepted by the <ExportDiscord> component.
 */
interface ExportDiscordProps {
    /**
     * The Discord handles and their associated granted state.
     */
    discord: DiscordDataExport;
}

/**
 * The <ExportDiscord> component lists the volunteers who should have access to the Discord role on
 * our server, and those who no longer should be granted access on our part.
 */
export function ExportDiscord(props: ExportDiscordProps) {
    const { discord } = props;

    return (
        <Stack direction="column" spacing={2}>
            { !!discord.granted.length &&
                <Paper sx={{ p: 2 }}>
                    <Alert severity="info" sx={{ mb: 1 }}>
                        The following volunteers should be granted the Crew role on the Discord
                        server.
                    </Alert>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell width="25%">Name</TableCell>
                                <TableCell width="25%">Role</TableCell>
                                <TableCell>Discord handle</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { discord.granted.map(({ name, role, handle }, index) =>
                                <TableRow key={index}>
                                    <TableCell>{name}</TableCell>
                                    <TableCell>{role}</TableCell>
                                    <TableCell>{handle}</TableCell>
                                </TableRow>)}
                        </TableBody>
                    </Table>
                </Paper> }
            { !!discord.revoked.length &&
                <Paper sx={{ p: 2 }}>
                    <Alert severity="warning" sx={{ mb: 1 }}>
                        The following volunteers should no longer be granted the Crew role{' '}
                        <strong>based on their participation in our teams</strong>—this is
                        important, as they may still be participating in another team.
                    </Alert>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell width="25%">Name</TableCell>
                                <TableCell>Discord handle</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { discord.revoked.map(({ name, handle }, index) =>
                                <TableRow key={index}>
                                    <TableCell>{name}</TableCell>
                                    <TableCell>{handle}</TableCell>
                                </TableRow>)}
                        </TableBody>
                    </Table>
                </Paper> }
            { (!discord.granted.length && !discord.revoked.length) &&
                <Alert severity="error">
                    There is no Discord information available to share with you.
                </Alert> }
        </Stack>
    );
}
