// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useRouter } from 'next/navigation';

import { Timeline, type TimelineEvent } from '@app/admin/components/Timeline';

/**
 * Props accepted by the <VolunteerSchedule> component.
 */
interface VolunteerScheduleProps {
    /**
     * Information about the event this volunteer will participate in.
     */
    event: {
        startTime: string;
        endTime: string;
        timezone: string;
    };

    /**
     * The schedule that should be displayed for this volunteer. It's immutable.
     */
    schedule: TimelineEvent[];
}

/**
 * The <VolunteerSchedule> component displays a timeline with the schedule for this volunteer,
 * which displays all their (un)availability and shifts in a concise manner.
 */
export function VolunteerSchedule(props: VolunteerScheduleProps) {
    const { event, schedule } = props;

    const router = useRouter();

    const min = Temporal.ZonedDateTime.from(event.startTime)
        .withTimeZone(event.timezone).with({ hour: 6, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    const max = Temporal.ZonedDateTime.from(event.endTime)
        .withTimeZone(event.timezone).with({ hour: 22, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    async function handleDoubleClick(event: TimelineEvent): Promise<undefined> {
        if (!event.animeConShiftId || !event.animeConShiftTeam)
            return;

        router.push(`../../${event.animeConShiftTeam}/shifts/${event.animeConShiftId}`);
        return undefined;
    }

    return (
        <Timeline min={min} max={max} displayTimezone={event.timezone} events={schedule}
                  onDoubleClick={handleDoubleClick} dense disableGutters readOnly />
    );
}
