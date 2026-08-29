// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import FreeCancellationIcon from '@mui/icons-material/FreeCancellation';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import Tooltip from '@mui/material/Tooltip';

import { Chip } from '@app/admin/components/Chip';

/**
 * Cell that renders a chip for the team and links to that team's volunteers page.
 */
export function ActivityTeamCell(props: {
    row: { team: string; teamColour: string };
}) {
    return <Chip color={props.row.teamColour} label={props.row.team} />;
}

/**
 * Cell that renders an icon corresponding to the activity type.
 */
export function ActivityTypeCell({ row }: { row: { type: string } }) {
    let icon: React.ReactNode = null;
    switch (row.type) {
        case 'Application':
            icon = <NewReleasesOutlinedIcon fontSize="small" />;
            break;
        case 'Availability':
            icon = <FreeCancellationIcon fontSize="small" />;
            break;
        case 'Hotel':
            icon = <HotelIcon fontSize="small" />;
            break;
        case 'Participation':
            icon = <SmartToyOutlinedIcon fontSize="small" />;
            break;
        case 'Refunds':
            icon = <MonetizationOnIcon fontSize="small" />;
            break;
        case 'Training':
            icon = <HistoryEduIcon fontSize="small" />;
            break;
    }

    if (!icon)
        return null;

    return (
        <Tooltip title={row.type}>
            {icon}
        </Tooltip>
    );
}
