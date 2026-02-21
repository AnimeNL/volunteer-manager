// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
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

import type { VolunteersDataExport } from '@app/api/exports/route';
import { useSelectElementText } from './useSelectElementText';

/**
 * Formats the given `gender` from the format we store it in, to the format AnPlan expects it in.
 */
function formatGender(gender: string): string {
    switch (gender) {
        case 'Female':
            return 'f';
        case 'Male':
            return 'm';
        default:
            return 'o';
    }
}

/**
 * Formats the given `shirtFit` from the format we store it in, to the format AnPlan expects it in.
 */
function formatShirtFit(shirtFit?: string): string {
    switch (shirtFit) {
        case 'Girly':
            return 'y';
        case 'Regular':
            return 'n';
        default:
            return '';
    }
}

/**
 * Extracts the intercalation from a volunteer's |lastName|, which is a surname prefix positioned
 * between a given name and the main surname such as "de" and "van de".
 */
function extractIntercalation(lastName: string) {
    const kIntercalations = [
        'der',
        'de',
        'ten',
        'ter',
        'van der',
        'van de',
        'van',
    ];

    const normalisedLastName = lastName.toLowerCase();
    for (const intercalation of kIntercalations) {
        if (!normalisedLastName.startsWith(intercalation))
            continue;

        if (normalisedLastName[intercalation.length] !== ' ')
            continue;  // John DeFoo

        return {
            intercalation,
            lastName: lastName.substring(intercalation.length),
        };
    }

    return {
        intercalation: '',
        lastName,
    };
}

/**
 * Props accepted by the <ExportVolunteers> component.
 */
interface ExportVolunteersProps {
    /**
     * The volunteer data export that should be rendered by this component.
     */
    volunteers: VolunteersDataExport;
}

/**
 * The <ExportVolunteers> component displays a comprehensive, sorted list of volunteers who are
 * participating in a particular event. All metadata required by the broader AnimeCon organisation
 * is included in the export.
 */
export function ExportVolunteers(props: ExportVolunteersProps) {
    const { volunteers } = props;

    const { elementRef, handleSelect } = useSelectElementText<HTMLTableElement>();

    return (
        <Paper sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}
                   action={
                       <Button onClick={handleSelect} size="small" color="info">
                           Select all
                       </Button> }>
                This table can be copied and pasted into Google Sheets and Microsoft Excel. Only
                confirmed participants are included.
            </Alert>
            <Table ref={elementRef} size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Department</TableCell>
                        <TableCell>Function</TableCell>
                        <TableCell>E-mail</TableCell>
                        <TableCell>First name</TableCell>
                        <TableCell>Prefix</TableCell>
                        <TableCell>Last name</TableCell>
                        <TableCell>Gender (m/f/o)</TableCell>
                        <TableCell>Age</TableCell>
                        <TableCell>T-shirt size</TableCell>
                        <TableCell>Girly fit (y/n)</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { volunteers && volunteers.map((volunteer, index) =>
                        <TableRow key={index}>
                            <TableCell>{volunteer.department}</TableCell>
                            <TableCell>{volunteer.role}</TableCell>
                            <TableCell>{volunteer.email}</TableCell>
                            <TableCell>{volunteer.firstName}</TableCell>
                            <TableCell>
                                {extractIntercalation(volunteer.lastName).intercalation}
                            </TableCell>
                            <TableCell>
                                {extractIntercalation(volunteer.lastName).lastName}
                            </TableCell>
                            <TableCell>{formatGender(volunteer.gender)}</TableCell>
                            <TableCell>{volunteer.age}</TableCell>
                            <TableCell>{volunteer.shirtSize}</TableCell>
                            <TableCell>{formatShirtFit(volunteer.shirtFit)}</TableCell>
                        </TableRow> )}
                </TableBody>
            </Table>
        </Paper>
    );
}
