// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import Stack from '@mui/material/Stack';

import type { VolunteerSummary } from '../lib/data/volunteerData';
import { Avatar } from '@components/Avatar';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { ScheduleListRow } from '../components/ScheduleList';
import { ScheduleSection } from '../components/ScheduleSection';
import { getSchedulePath } from '../lib/navigationTypes';

/**
 * Props accepted by the `<VolunteerTeamRoster>` component.
 */
interface VolunteerTeamRosterProps {
    eventSlug: string;
    teamName: string;
    volunteers: VolunteerSummary[];
}

/**
 * Builds the primary title node for a volunteer row, appending a subtle role label for leaders.
 */
function renderVolunteerTitle(volunteer: VolunteerSummary): React.ReactNode {
    if (!volunteer.roleLeader)
        return volunteer.name;

    return (
        <>
            {volunteer.name}
            <Box
                component="span"
                sx={{ color: 'text.secondary', fontWeight: 400, ml: 0.75 }}>
                · {volunteer.role}
            </Box>
        </>
    );
}

/**
 * Builds the concise supporting line for a volunteer row based on their current availability.
 */
function renderVolunteerSubtitle(
    volunteer: VolunteerSummary,
    section: 'backup' | 'offShift' | 'onShift' | 'unavailable'): React.ReactNode
{
    if (section === 'backup') {
        return (
            <Stack
                component="span"
                direction="row"
                spacing={0.75}
                sx={{
                    alignItems: 'center',
                    color: 'info.main',
                    display: 'inline-flex',
                    maxWidth: '100%',
                }}>
                <HourglassBottomOutlinedIcon fontSize="inherit" />
                <Box
                    component="span"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {volunteer.role} · Available to help
                </Box>
            </Stack>
        );
    }

    if (section === 'onShift') {
        return (
            <Stack
                component="span"
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center', display: 'inline-flex', maxWidth: '100%' }}>
                <Box
                    component="span"
                    sx={{
                        bgcolor: 'primary.main',
                        borderRadius: '50%',
                        flexShrink: 0,
                        height: 6,
                        width: 6,
                    }} />
                <Box
                    component="span"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {volunteer.activeShift}
                </Box>
            </Stack>
        );
    }

    if (section === 'unavailable') {
        if (volunteer.unavailableUntil === 'indefinite')
            return `${volunteer.role} · Unavailable`;

        return `${volunteer.role} · Back at ${volunteer.unavailableUntil}`;
    }

    return volunteer.role;
}

/**
 * Renders a single neutral-surface section of volunteers.
 */
function renderRosterSection(
    title: string,
    volunteers: VolunteerSummary[],
    section: 'backup' | 'offShift' | 'onShift' | 'unavailable',
    eventSlug: string): React.ReactNode
{
    if (!volunteers.length)
        return null;

    const isUnavailable = section === 'unavailable';

    return (
        <ScheduleSection
            key={section}
            muted={isUnavailable}
            title={`${title} · ${volunteers.length}`}>
            { volunteers.map(volunteer => (
                <ScheduleListRow
                    key={volunteer.id}
                    chevron
                    href={getSchedulePath(eventSlug, `/volunteers/${volunteer.id}`)}
                    leading={
                        <Box sx={{ opacity: isUnavailable ? 0.55 : 1 }}>
                            <Avatar src={volunteer.avatar}>{volunteer.name}</Avatar>
                        </Box>
                    }
                    subtitle={renderVolunteerSubtitle(volunteer, section)}
                    title={renderVolunteerTitle(volunteer)} />
            )) }
        </ScheduleSection>
    );
}

/**
 * Renders a team's volunteer roster in the Backup-First Minimal layout: Backup volunteers first,
 * followed by On shift, Off shift, and recessed Unavailable volunteers on neutral surfaces.
 */
export function VolunteerTeamRoster(props: VolunteerTeamRosterProps) {
    const { eventSlug, teamName, volunteers } = props;

    if (!volunteers.length) {
        return (
            <EmptyStateCard
                description={`No volunteers have been assigned to ${teamName} yet.`} />
        );
    }

    const backup: VolunteerSummary[] = [];
    const onShift: VolunteerSummary[] = [];
    const offShift: VolunteerSummary[] = [];
    const unavailable: VolunteerSummary[] = [];

    for (const volunteer of volunteers) {
        if (volunteer.unavailableUntil)
            unavailable.push(volunteer);
        else if (volunteer.activeShift && volunteer.isBackup)
            backup.push(volunteer);
        else if (volunteer.activeShift)
            onShift.push(volunteer);
        else
            offShift.push(volunteer);
    }

    return (
        <Stack spacing={2} useFlexGap>
            {renderRosterSection('Backup', backup, 'backup', eventSlug)}
            {renderRosterSection('On shift', onShift, 'onShift', eventSlug)}
            {renderRosterSection('Off shift', offShift, 'offShift', eventSlug)}
            {renderRosterSection('Unavailable', unavailable, 'unavailable', eventSlug)}
        </Stack>
    );
}
