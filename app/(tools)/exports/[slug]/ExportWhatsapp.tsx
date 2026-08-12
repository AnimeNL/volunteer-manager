// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Table from '@mui/material/Table';

import type { WhatsAppDataExport } from '@app/api/exports/route';
import { useSelectElementText } from './useSelectElementText';

/**
 * Props accepted by the <ExportWhatsappProps> component.
 */
interface ExportWhatsappProps {
    /**
     * The WhatsApp contact data export that should be rendered by this component.
     */
    whatsapp: WhatsAppDataExport;
}

/**
 * The <ExportWhatsapp> component displays a comprehensive, sorted list of volunteers who are
 * have chosen to participate in our social media channels, which includes WhatsApp.
 */
export function ExportWhatsapp(props: ExportWhatsappProps) {
    const { whatsapp } = props;

    const { elementRef, handleSelect } = useSelectElementText<HTMLTableElement>();

    return (
        <Paper sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}
                   action={
                       <Button onClick={handleSelect} size="small" color="info">
                           Select all
                       </Button> }>
                This table can be copied and pasted into Google Sheets and Microsoft Excel. Only
                confirmed participants who want to participate in our socials are included.
            </Alert>
            <Table ref={elementRef} size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Role</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Phone number</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { whatsapp && whatsapp.map((info, index) =>
                        <TableRow key={index}>
                            <TableCell>{info.role}</TableCell>
                            <TableCell>{info.name}</TableCell>
                            <TableCell>{info.phoneNumber}</TableCell>
                        </TableRow> )}
                </TableBody>
            </Table>
        </Paper>
    );
}
