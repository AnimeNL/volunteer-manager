// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import EmailIcon from '@mui/icons-material/Email';
import IconButton from '@mui/material/IconButton';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { CommunicationLanguage } from '@lib/database/Types';
import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import type { ServerActionResult } from '@lib/serverAction';
import { CommunicationIconButton } from '@app/admin/components/CommunicationDialog';

/**
 * Cell that serves as the header enabling training confirmation communication to be initiated.
 */
export function TrainingCommunicationHeaderCell() {
    return (
        <Tooltip title="Confirm their training participation?">
            <EmailIcon color="action" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Context passed to the <TrainingCommunicationCell> component.
 */
export interface TrainingCommunicationCellContext {
    /**
     * Server Action to be invoked when a training communication is due to be sent.
     */
    action: (
        recipientId: number, teamId: number, promptId: CommunicationPromptId, subject?: string,
        message?: string) => Promise<ServerActionResult>;

    /**
     * Unique ID of the event for which training assignments are being managed.
     */
    eventId: number;
}

/**
 * Props accepted by the <TrainingCommunicationCell> component.
 */
interface TrainingCommunicationCellProps {
    /**
     * Context passed to the communication cell.
     */
    context?: TrainingCommunicationCellContext;

    /**
     * Row model containing training assignment and volunteer identity details.
     */
    row: {
        assignedTrainingId?: number;
        communication?: Record<string, string>;
        confirmed?: boolean;
        language?: CommunicationLanguage;
        name?: string;
        userId?: number;
        team?: {
            id: number;
        };
    };
}

/**
 * Cell that contains a communication button through which a volunteer with a confirmed training
 * assignment can be sent a confirmation or reminder e-mail.
 */
export function TrainingCommunicationCell(props: TrainingCommunicationCellProps) {
    const { action, eventId } = props.context!;
    const { row } = props;

    if (!row.userId || !row.team?.id || !row.name || !row.confirmed ||
        row.assignedTrainingId === undefined || row.assignedTrainingId < 0)
    {
        return (
            <IconButton disabled size="small">
                <EmailIcon color="disabled" fontSize="small" />
            </IconButton>
        );
    }

    const communication = row.communication ?? {};
    const promptParams = {
        eventId,
        teamId: row.team.id,
        trainingId: row.assignedTrainingId,
    };

    const prompts: React.ComponentProps<typeof CommunicationIconButton>['prompts'] = [
        {
            promptId: 'training-confirmation',
            promptParams,
            title: 'Confirm training participation',
            mostRecentCommunication: communication['training-confirmation'],
        },
    ];

    if (row.assignedTrainingId > 0) {
        prompts.push({
            promptId: 'training-reminder',
            promptParams,
            title: 'Send training reminder',
            mostRecentCommunication: communication['training-reminder'],
        });
    }

    return (
        <CommunicationIconButton
            badge={communication['training-confirmation'] ? 'check' : 'none'}
            title={`Update ${row.name} about their training participation?`}
            action={action.bind(null, row.userId, row.team.id)}
            disableSilent
            language={row.language}
            recipientId={row.userId}
            prompts={prompts}>

            Send <strong>{row.name}</strong> an e-mail regarding their training participation.

        </CommunicationIconButton>
    );
}

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
    field: 'assignedTrainingId' | 'preferenceTrainingId' | 'preferredTrainingId';

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
    row: Partial<Record<TrainingSessionCellContext['field'], number>>;
}

/**
 * Cell component for displaying a preferred or assigned training session, showing a pending icon
 * when no selection has been made yet or muted text when skipping the training.
 */
export function TrainingSessionCell(props: TrainingSessionCellProps) {
    const field = props.context?.field;
    const value = field ? props.row[field] : undefined;

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
