// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PaletteIcon from '@mui/icons-material/Palette';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { ExcitementIcon } from '@app/admin/components/ExcitementIcon';
import { Square } from '@app/admin/components/Square';

/**
 * Formats the given number of `minutes` to a HH:MM string.
 */
function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes - hours * 60;

    return remainingMinutes ? `${hours}:${(`00` + remainingMinutes).slice(-2)}`
                            : `${hours}`;
}

/**
 * Header of the colour column.
 */
export function ColourHeader() {
    return (
        <Tooltip title="Colour assigned to this shift">
            <PaletteIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Cell visualising the colour assigned to a particular shift.
 */
export function ColourCell(props: { row: { colour: string } }) {
    return <Square colour={props.row.colour} title="Colour assigned to this shift" />;
}

/**
 * Cell visualising the amount of time has been requested for a shift.
 */
export function DemandCell(props: { row: { demandInMinutes?: number } }) {
    if (!props.row.demandInMinutes) {
        return (
            <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                ···
            </Typography>
        );
    }

    return <>{formatMinutes(props.row.demandInMinutes)} hours</>;
}

/**
 * Header for the cell that indicates whether a description has been written.
 */
export function DescriptionHeader() {
    return (
        <Tooltip title="Shift description written?">
            <DescriptionOutlinedIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Cell highlighting whether a shift description has been written.
 */
export function DescriptionCell(props: { row: { description?: string } }) {
    if (!!props.row.description?.length) {
        return (
            <Tooltip title="Description has been written">
                <DescriptionOutlinedIcon fontSize="small" color="success" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Description is missing">
                <DescriptionOutlinedIcon fontSize="small" color="warning" />
            </Tooltip>
        );
    }
}

/**
 * Header for the cell indicating the excitement level.
 */
export function ExcitementHeader() {
    return (
        <Tooltip title="Volunteer sentiment">
            <SentimentSatisfiedAltIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Cell visualising the excitement level volunteers have for this shift.
 */
export function ExcitementCell(props: { row: { excitement: number } }) {
    return <ExcitementIcon excitement={props.row.excitement} />;
}

/**
 * Cell visualising the amount of time that has been scheduled for a shift.
 */
export function ScheduledCell(props: {
    row: { demandInMinutes?: number, scheduledInMinutes?: number }
}) {
    if (!props.row.scheduledInMinutes) {
        return (
            <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                ···
            </Typography>
        );
    }

    let color: 'warning.main' | 'success.main' | undefined;
    if (!!props.row.demandInMinutes) {
        if (props.row.scheduledInMinutes < props.row.demandInMinutes)
            color = 'warning.main';
        else
            color = 'success.main';
    }

    return (
        <Typography component="span" variant="body2" sx={{ color }}>
            {formatMinutes(props.row.scheduledInMinutes)} hours
        </Typography>
    );
}
