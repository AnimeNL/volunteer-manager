// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import RemoveCircleOutlinedIcon from '@mui/icons-material/RemoveCircleOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

/**
 * Cell renderer for the team name column. Striking out deleted teams and adding a tooltip.
 */
export function TeamNameCell(props: { row: { name: string; hasTeamBeenDeleted?: boolean; } }) {
    if (!props.row.hasTeamBeenDeleted)
        return props.row.name;

    return (
        <>
            <Typography variant="body2" sx={{ textDecoration: 'line-through', pt: 0.25 }}>
                {props.row.name}
            </Typography>
            <Tooltip title="This team has been disabled">
                <RemoveCircleOutlinedIcon color="error" fontSize="small" sx={{ ml: 1 }} />
            </Tooltip>
        </>
    );
}
