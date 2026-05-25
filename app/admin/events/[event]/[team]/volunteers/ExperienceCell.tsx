// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import GradeIcon from '@mui/icons-material/Grade';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';

import type { VolunteerRowModel } from '../volunteers2/page';

/**
 * Cell that serves as the header for indicating the volunteer's experience.
 */
export function ExperienceHeaderCell() {
    return (
        <Tooltip title="FYI">
            <InfoOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell used to illustrate a volunteer's experience. Both first-time volunteers and Senior and Staff
 * volunteers will be highlighted in the table.
 */
export function ExperienceCell(props: { row: VolunteerRowModel }) {
    if (!!props.row.roleHasPermissionGrant) {
        return (
            <Tooltip title="Senior role">
                <GradeIcon color="warning" fontSize="small" />
            </Tooltip>
        );
    }

    // TODO: Highlight new volunteers

    return null;
}
