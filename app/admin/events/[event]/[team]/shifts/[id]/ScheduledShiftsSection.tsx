// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import ScheduleIcon from '@mui/icons-material/Schedule';

import type { PageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Temporal } from '@lib/Temporal';
import { Timeline, type TimelineEvent } from '@app/admin/components/Timeline';
import { VisibilityContext } from './ShiftTeamVisibilityContext';

/**
 * Props accepted by the <ScheduledShiftsSection> component.
 */
interface ScheduledShiftsSectionProps {
    /**
     * Whether this section should be expanded by default.
     */
    defaultExpanded?: boolean;

    /**
     * Information about the event for which the demand section is being shown.
     */
    event: PageInfo['event'];

    /**
     * The individual shifts that have been scheduled so far.
     */
    shifts: TimelineEvent[];

    /**
     * Unique ID of the team for whom the page primarily is being shown.
     */
    teamId: number;
}

/**
 * The <ScheduledShiftsSection> component displays the shifts that have actually been scheduled and
 * are assigned to particular volunteers. The view combines shifts from all different teams.
 */
export function ScheduledShiftsSection(props: ScheduledShiftsSectionProps) {
    const { defaultExpanded, event } = props;

    const includeAllTeams = useContext(VisibilityContext);
    const shifts = useMemo(() => props.shifts.filter(shift => {
        return includeAllTeams || shift.animeConTeamId === props.teamId;

    }), [ includeAllTeams, props.shifts, props.teamId ]);

    const min = Temporal.ZonedDateTime.from(event.startTime)
        .withTimeZone(event.timezone).with({ hour: 6, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    const max = Temporal.ZonedDateTime.from(event.endTime)
        .withTimeZone(event.timezone).with({ hour: 22, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    const router = useRouter();

    async function handleDoubleClick(event: TimelineEvent): Promise<undefined> {
        if (!event.animeConTeam || !event.animeConUserId)
            return;

        router.push(`../../${event.animeConTeam}/volunteers/${event.animeConUserId}`);
        return undefined;
    }

    const subtitle = shifts.length === 1 ? '1 shift' : `${shifts.length} shifts`;

    return (
        <ExpandableSection icon={ <ScheduleIcon color="info" /> } defaultExpanded={defaultExpanded}
                           setting="user-admin-shifts-expand-shifts"
                           title="Volunteering schedule" subtitle={subtitle}>
            <SectionIntroduction>
                The following volunteers have been scheduled for this shift. This is for
                your information—use the{' '}
                <MuiLink component={Link} href="../schedule">
                    Scheduling Tool
                </MuiLink>
                {' '}to make changes.
            </SectionIntroduction>
            <Timeline min={min} max={max} displayTimezone={event.timezone} events={shifts}
                      onDoubleClick={handleDoubleClick} dense disableGutters readOnly />
        </ExpandableSection>
    );
}
