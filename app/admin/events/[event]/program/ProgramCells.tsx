// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import AddTaskIcon from '@mui/icons-material/AddTask';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LaunchIcon from '@mui/icons-material/Launch';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { Square } from '@app/admin/components/Square';

/**
 * Header component for columns that link out to AnPlan.
 */
export function AnPlanLinkHeader() {
    return (
        <Tooltip title="Open in AnPlan">
            <LaunchIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell component for columns linking out to AnPlan.
 */
export function AnPlanLinkCell(props: { row: { anplanLink?: string } }) {
    if (!props.row.anplanLink) {
        return (
            <Tooltip title="This item does not exist in AnPlan">
                <LaunchIcon color="disabled" fontSize="small" />
            </Tooltip>
        );
    }

    return (
        <Tooltip title="Open this item in AnPlan">
            <IconButton component={Link} href={props.row.anplanLink} target="_blank" size="small">
                <LaunchIcon color="info" fontSize="small" />
            </IconButton>
        </Tooltip>
    );
}

/**
 * Cell component for displaying an activity title, linking to details for external activities.
 */
export function ActivityTitleCell(props: { row: { id: number; title: string; anplanLink?: string } }) {
    if (!props.row.anplanLink)
        return <>{props.row.title}</>;

    return (
        <MuiLink component={Link} href={`./activities/${props.row.id}`}>
            {props.row.title}
        </MuiLink>
    );
}

/**
 * Cell component for displaying an activity's location and timeslot count.
 */
export function ActivityLocationCell(props: {
    row: { location: string; locationId?: number | null; timeslots: number; anplanLink?: string }
}) {
    if (props.row.location === 'No locations…') {
        if (!!props.row.anplanLink) {
            return (
                <Typography variant="inherit" color="textDisabled" component="span">
                    ···
                </Typography>
            );
        }

        return (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                {props.row.location}
            </Typography>
        );
    }

    return (
        <>
            { !props.row.locationId && props.row.location }
            { !!props.row.locationId &&
                <MuiLink component={Link} href="./locations">
                    {props.row.location}
                </MuiLink> }
            { props.row.timeslots > 1 &&
                <Typography variant="body2" sx={{ pl: .5, color: 'text.disabled' }}>
                    ({props.row.timeslots}x)
                </Typography> }
        </>
    );
}

/**
 * Header component for the help requested column.
 */
export function HelpRequestedHeader() {
    return (
        <Tooltip title="Has help been requested?">
            <NewReleasesIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell component for displaying help request status.
 */
export function HelpRequestedCell(props: {
    row: { helpRequested: boolean; shiftScheduled: boolean };
}) {
    if (props.row.shiftScheduled) {
        return (
            <Tooltip title="Shifts have been scheduled">
                <NewReleasesIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }

    if (props.row.helpRequested) {
        return (
            <Tooltip title="Help has been requested">
                <NewReleasesIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }

    return (
        <Typography variant="inherit" color="textDisabled" component="span">
            ···
        </Typography>
    );
}

/**
 * Header component for the visibility column.
 */
export function VisibleHeader() {
    return (
        <Tooltip title="Has the activity been published?">
            <VisibilityIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell component for displaying publication visibility.
 */
export function VisibleCell(props: { row: { visible: boolean } }) {
    if (props.row.visible) {
        return (
            <Tooltip title="This activity has been announced">
                <VisibilityIcon color="disabled" fontSize="small" />
            </Tooltip>
        );
    }

    return (
        <Tooltip title="This activity should be kept private">
            <VisibilityOffIcon color="warning" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell component for displaying a display name with fallback to the original name in italics.
 */
export function DisplayNameCell(props: { row: { displayName?: string | null; name: string } }) {
    if (props.row.displayName)
        return <>{props.row.displayName}</>;

    return (
        <Typography component="span" color="textDisabled" variant="body2"
                    sx={{ fontStyle: 'italic' }}>
            {props.row.name}
        </Typography>
    );
}

/**
 * Cell component for displaying the request status as a Chip.
 */
export function RequestStatusCell(props: {
    row: { status: 'Contacted' | 'Scheduled' | 'Unknown' };
}) {
    switch (props.row.status) {
        case 'Contacted':
            return (
                <Tooltip title="Someone is coordinating with the event owner">
                    <Chip size="small" label="Contacted" color="warning" />
                </Tooltip>
            );

        case 'Scheduled':
            return (
                <Tooltip title="Shifts for this activity have been scheduled">
                    <Chip size="small" label="Scheduled" color="success" />
                </Tooltip>
            );

        case 'Unknown':
        default:
            return (
                <Tooltip title="This request has not been picked up yet">
                    <Chip size="small" label="Unknown" color="error" />
                </Tooltip>
            );
    }
}

/**
 * Header component for the team shift column in program requests.
 */
export function RequestTeamShiftHeader(props: { context?: { colour: string; name: string } }) {
    if (!props.context)
        return null;

    return <Square colour={props.context.colour} title={props.context.name} />;
}

/**
 * Cell component for displaying shifts scheduled by a specific team for a program request.
 */
export function RequestTeamShiftCell(props: {
    context?: { event: string; teamId: number; teamSlug: string };
    row: { shifts: Record<string, number[]> };
}) {
    if (!props.context)
        return null;

    const shifts = props.row.shifts?.[`${props.context.teamId}`];

    if (!shifts || shifts.length === 0) {
        return (
            <Tooltip title="No shifts have been scheduled">
                <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
            </Tooltip>
        );
    }

    if (shifts.length === 1) {
        const href =
            `/admin/events/${props.context.event}/${props.context.teamSlug}/shifts/${shifts[0]}`;

        return (
            <Tooltip title="One shift has been scheduled">
                <MuiLink component={Link} href={href} sx={{ lineHeight: '0.5em' }}>
                    <TaskAltIcon fontSize="small" color="success" />
                </MuiLink>
            </Tooltip>
        );
    }

    return (
        <Tooltip title={`${shifts.length} shifts have been scheduled`}>
            <AddTaskIcon fontSize="small" color="warning" />
        </Tooltip>
    );
}
