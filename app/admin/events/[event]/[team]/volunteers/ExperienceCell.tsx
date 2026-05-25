// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Filter2Icon from '@mui/icons-material/Filter2';
import Filter3Icon from '@mui/icons-material/Filter3';
import Filter4Icon from '@mui/icons-material/Filter4';
import Filter5Icon from '@mui/icons-material/Filter5';
import Filter6Icon from '@mui/icons-material/Filter6';
import Filter7Icon from '@mui/icons-material/Filter7';
import Filter8Icon from '@mui/icons-material/Filter8';
import Filter9Icon from '@mui/icons-material/Filter9';
import Filter9PlusIcon from '@mui/icons-material/Filter9Plus';
import FilterVintageIcon from '@mui/icons-material/FilterVintage';
import GradeIcon from '@mui/icons-material/Grade';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';

import type { VolunteerRowModel } from './page';

/**
 * Cell that serves as the header for indicating the volunteer's experience.
 */
export function ExperienceHeaderCell() {
    return (
        <Tooltip title="Experience level">
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
            <Tooltip title="Senior/Staff volunteer">
                <GradeIcon color="warning" fontSize="small" />
            </Tooltip>
        );
    }

    if (!props.row.priorParticipationCount) {
        return (
            <Tooltip title="New volunteer">
                <FilterVintageIcon color="info" fontSize="small" />
            </Tooltip>
        );
    }

    const kExperienceIcons = [
        Filter2Icon, Filter3Icon, Filter4Icon, Filter5Icon, Filter6Icon, Filter7Icon, Filter8Icon,
        Filter9Icon ];

    const tooltip = generateOrdinalTooltip(props.row.priorParticipationCount + 1);
    const Icon = kExperienceIcons[props.row.priorParticipationCount - 1] ?? Filter9PlusIcon;

    return (
        <Tooltip title={tooltip}>
            <Icon color="disabled" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Generates the tooltip for a volunteer who has participated |count| times.
 */
function generateOrdinalTooltip(count: number): string {
    const suffices = [ 'th', 'st', 'nd', 'rd' ];
    const v = count % 100;

    return `${count}${suffices[(v - 20) % 10] || suffices[v] || suffices[0]} event`;
}
