// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Table from '@mui/material/Table';
import Typography from '@mui/material/Typography';

import type { RefundsDataExport } from '@app/api/exports/route';
import { formatDate } from '@lib/Temporal';
import { useSelectElementText } from './useSelectElementText';

/**
 * Props accepted by the <ExportRefunds> component.
 */
interface ExportRefundsProps {
    /**
     * The refund requests that should be rendered by this component.
     */
    refunds: RefundsDataExport;
}

/**
 * The <ExportRefunds> component displays the refund requests received by volunteers for a given
 * event. The data is obtained from the server.
 */
export function ExportRefunds(props: ExportRefundsProps) {
    const { refunds } = props;

    const { elementRef, handleSelect } = useSelectElementText<HTMLTableElement>();

    return (
        <Stack direction="column" spacing={2}>
            { !!refunds &&
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h5" sx={{ mb: 1 }}>
                        Ticket refund requests
                    </Typography>
                    <Alert severity="info" sx={{ mb: 1 }}
                           action={
                               <Button onClick={handleSelect} size="small" color="info">
                                   Select all
                               </Button> }>
                        This table can be copied and pasted into Google Sheets and Microsoft Excel.
                    </Alert>
                    <Table ref={elementRef} size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Volunteer</TableCell>
                                <TableCell>Requested</TableCell>
                                <TableCell>Ticket number</TableCell>
                                <TableCell>Account (IBAN)</TableCell>
                                <TableCell>Account (name)</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { refunds.requests.map((request, index) =>
                                <TableRow key={index}>
                                    <TableCell>{request.name}</TableCell>
                                    <TableCell>
                                        { formatDate(
                                            Temporal.ZonedDateTime.from(request.date), 'YYYY-MM-DD')
                                        }
                                    </TableCell>
                                    <TableCell>{request.ticketNumber ?? '(unknown)'}</TableCell>
                                    <TableCell>{request.accountIban}</TableCell>
                                    <TableCell>{request.accountName}</TableCell>
                                </TableRow> )}
                        </TableBody>
                    </Table>
                </Paper> }
        </Stack>
    );
}
