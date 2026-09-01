// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import IconButton from '@mui/material/IconButton';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import Tooltip from '@mui/material/Tooltip';

import { RemoteGraphDialog } from '../finance/graphs/RemoteGraphDialog';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';

import { fetchTeamGrowth } from './EventTeamsCardFn';

/**
 * Props accepted by the <EventTeamsGrowthIconButton> component.
 */
interface EventTeamsGrowthIconButtonProps {
    /**
     * Unique ID of the event in the database.
     */
    eventId: number;

    /**
     * URL-safe slug representing the event.
     */
    eventSlug: string;

    /**
     * Unique ID of the team in the database.
     */
    teamId: number;

    /**
     * Name of the team.
     */
    teamName: string;
}

/**
 * Displays an icon button that opens a <RemoteGraphDialog> displaying volunteer growth for a team.
 */
export function EventTeamsGrowthIconButton(props: EventTeamsGrowthIconButtonProps) {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleClose = useCallback(() => setOpen(false), [ ]);
    const handleOpen = useCallback(() => setOpen(true), [ ]);

    const fetchDataFn = fetchTeamGrowth.bind(
        null, props.eventId, props.eventSlug, [ props.teamId ]);

    return (
        <>
            <IconButton onClick={handleOpen} size="small">
                <Tooltip title="Volunteer growth">
                    <TooltipIconWrapper>
                        <SsidChartIcon color="primary" fontSize="inherit" />
                    </TooltipIconWrapper>
                </Tooltip>
            </IconButton>
            { !!open &&
                <RemoteGraphDialog
                    fetchDataFn={fetchDataFn}
                    onClose={handleClose}
                    title={props.teamName} /> }
        </>
    );
}
