// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { Timeline, type TimelineEvent } from '@app/admin/components/Timeline';
import { VisibilityContext } from './ShiftTeamVisibilityContext';

/**
 * Props accepted by the <ScheduledShiftsSection> component.
 */
interface ScheduledShiftsSectionProps {
    /**
     * Information about the event for which the demand section is being shown.
     */
    event: {
        /**
         * Date and time at which the event will commence, in a ZonedDateTime serialisation.
         */
        startTime: string;

        /**
         * Date and time at which the event will conclude, in a ZonedDateTime serialisation.
         */
        endTime: string;

        /**
         * Name of the timezone in which the shifts are being scheduled.
         */
        timezone: string;
    };

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
    const { event } = props;

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

    return (
        <Timeline min={min} max={max} displayTimezone={event.timezone} events={shifts}
                  onDoubleClick={handleDoubleClick} dense disableGutters readOnly />
    );
}
