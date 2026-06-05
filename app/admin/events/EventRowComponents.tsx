// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { Chip } from '@app/admin/components/Chip';

/**
 * Component that renders either a "visible" or an "invisible" icon based on whether the event has
 * been published, quickly indicating whether it's visible for visitors.
 */
export function EventStatusCell({ row }: { row: { hidden: boolean } }) {
    if (row.hidden) {
        return (
            <Tooltip title="This event has been suspended">
                <VisibilityOffIcon color="disabled" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="This event is currently active">
                <VisibilityIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }
}

/**
 * Component that renders a list of the teams that participate in this event.
 */
export function EventTeamsCell(
    { row }: { row: { teams: { name: string, themeColor: string }[] } })
{
    if (!row.teams || !row.teams.length)
        return null;

    const teams = [ ...row.teams ];
    teams.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    return (
        <Stack direction="row" spacing={1}>
            { teams.map((team, index) =>
                <Chip key={index} color={team.themeColor} label={team.name} /> ) }
        </Stack>
    );
}
