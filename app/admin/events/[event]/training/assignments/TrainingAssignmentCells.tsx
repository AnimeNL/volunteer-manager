// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

/**
 * Context passed to the <TrainingParticipantCell> component.
 */
export interface TrainingParticipantCellContext {
    /**
     * Unique slug of the event for which training assignments are being displayed.
     */
    event: string;
}

/**
 * Props accepted by the <TrainingParticipantCell> component.
 */
interface TrainingParticipantCellProps {
    /**
     * Context identifying the event.
     */
    context?: TrainingParticipantCellContext;

    /**
     * Row model of the training participant being rendered.
     */
    row: {
        name?: string;
        new?: boolean;
        userId?: number;
        team?: {
            color: string;
            name: string;
            slug: string;
        };
    };
}

/**
 * Cell component for displaying a training participant, showing their team color bar, a link to
 * their volunteer profile, and a blue dot if they have not participated in a training before.
 */
export function TrainingParticipantCell(props: TrainingParticipantCellProps) {
    const { row } = props;

    if (!props.context?.event || !row.userId || !row.team)
        return <>{row.name}</>;

    const href = `/admin/events/${props.context.event}/${row.team.slug}/volunteers/${row.userId}`;
    return (
        <>
            <Tooltip title={row.team.name}>
                <Box sx={{
                    position: 'absolute',
                    width: '4px',
                    height: '35px',
                    backgroundColor: row.team.color,
                    marginLeft: '-10px',
                    marginTop: '0px',
                }} />
            </Tooltip>
            <MuiLink component={Link} href={href}>
                {row.name}
            </MuiLink>
            { row.new &&
                <Box sx={{
                    position: 'relative',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#00B8D4',
                    borderRadius: '4px',
                    marginLeft: '8px',
                }} /> }
        </>
    );
}

/**
 * Context passed to the <TrainingSessionCell> component.
 */
export interface TrainingSessionCellContext {
    /**
     * Field on the row model containing the training session ID (`-1` = pending, `0` = skip,
     * `>0` = trainingId).
     */
    field: string;

    /**
     * Tooltip to display when the value is pending (`-1`).
     */
    pendingTooltip: string;

    /**
     * Available training session options.
     */
    trainings: { value: number; label: string }[];
}

/**
 * Props accepted by the <TrainingSessionCell> component.
 */
interface TrainingSessionCellProps {
    /**
     * Context configuring the field, tooltip, and available training sessions.
     */
    context?: TrainingSessionCellContext;

    /**
     * Row model being rendered.
     */
    row: Record<string, any>;
}

/**
 * Cell component for displaying a preferred or assigned training session, showing a pending icon
 * when no selection has been made yet or muted text when skipping the training.
 */
export function TrainingSessionCell(props: TrainingSessionCellProps) {
    const field = props.context?.field ?? '';
    const value = props.row[field];

    if (value === -1) {
        return (
            <Tooltip title={props.context?.pendingTooltip ?? 'Pending'}>
                <MoreHorizIcon color="warning" fontSize="small" />
            </Tooltip>
        );
    }

    if (value === 0) {
        return (
            <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                Skip the training
            </Typography>
        );
    }

    const option = props.context?.trainings.find(entry => entry.value === value);
    if (option)
        return <>{option.label}</>;

    return <Typography variant="overline">[unknown]</Typography>;
}
