// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CheckBoxOutlineBlankOutlinedIcon from '@mui/icons-material/CheckBoxOutlineBlankOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import GroupOffOutlinedIcon from '@mui/icons-material/GroupOffOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import Tooltip from '@mui/material/Tooltip';

import { Chip } from '@app/admin/components/Chip';

/**
 * Cell renderer for the team badge column.
 */
export function BadgeCell(props: { row: { color: string; name: string } }) {
    return <Chip color={props.row.color} label={props.row.name} />;
}

/**
 * Header for the column that indicates hotel room eligibility.
 */
export function HotelEligibleHeaderCell() {
    return (
        <Tooltip title="Are they eligible to hotel rooms?">
            <HotelIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell to visualise whether this role is eligible to book hotel rooms.
 */
export function HotelEligibleCell(props: { row: { hotelEligible?: boolean } }) {
    if (!!props.row.hotelEligible) {
        return (
            <Tooltip title="Eligible to hotel rooms">
                <HotelIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Not eligible to hotel rooms">
                <HotelIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }
}

/**
 * Header for the column that indicates default role restrictions.
 */
export function RestrictedDefaultHeaderCell() {
    return (
        <Tooltip title="Can this be a team's default role?">
            <CheckBoxOutlineBlankOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell to visualise whether this role is restricted from being the default role.
 */
export function RestrictedDefaultCell(props: { row: { flagDefaultRestricted?: boolean } }) {
    if (!!props.row.flagDefaultRestricted) {
        return (
            <Tooltip title="May not be a team's default role">
                <IndeterminateCheckBoxOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="May be a team's default role">
                <CheckBoxOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }
}

/**
 * Header for the column that indicates whether a team is enabled.
 */
export function TeamEnabledHeaderCell() {
    return (
        <Tooltip title="Has this team been enabled?">
            <GroupOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell to visualise whether this team has been enabled.
 */
export function TeamEnabledCell(props: { row: { enabled: boolean } }) {
    if (!!props.row.enabled) {
        return (
            <Tooltip title="Team is enabled">
                <GroupOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Team has been disabled">
                <GroupOffOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }
}

/**
 * Header for the column that indicates training eligibility.
 */
export function TrainingEligibleHeaderCell() {
    return (
        <Tooltip title="Are they eligible to receive training?">
            <HistoryEduIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell to visualise whether this role is eligible to join the training.
 */
export function TrainingEligibleCell(props: { row: { trainingEligible?: boolean } }) {
    if (!!props.row.trainingEligible) {
        return (
            <Tooltip title="Eligible to receive training">
                <HistoryEduIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Not eligible to receive training">
                <HistoryEduIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }
}
