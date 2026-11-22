// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext, useMemo } from 'react';

import type { VolunteerShiftInfo } from './Types';
import { ActiveShiftCard } from './components/ActiveShiftCard';
import { DutyBookCard } from './components/DutyBookCard';
import { HelpRequestsCard } from './components/HelpRequestsCard';
import { HelpRequestsUrgentCard } from './components/HelpRequestsUrgentCard';
import { JobCompletedCard } from './components/JobCompletedCard';
import { KnowledgeBaseCard } from './components/KnowledgeBaseCard';
import { NardoAdviceCard } from './components/NardoAdviceCard';
import { OverviewVendorCard } from './components/OverviewVendorCard';
import { ScheduleContext } from './ScheduleContext';
import { SetTitle } from './components/SetTitle';
import { TicketCard } from './components/TicketCard';
import { UpcomingShiftCard } from './components/UpcomingShiftCard';
import { currentTimestamp } from './CurrentTime';
import { useIsMobile } from './lib/useIsMobile';

import { kVendorTeam } from '@lib/database/Types';

/**
 * Duration after the volunteer's first shift ends during which the ticket card remains visible on
 * the overview page, in seconds.
 */
const kTicketCardVisibilityGraceSeconds = /* one hour= */ 60 * 60;

/**
 * Displays the portal's overview page, which contains a series of cards displaying key information
 * necessary for the volunteer to perform their duties. All information is sourced from the context.
 */
export function OverviewPage() {
    const { schedule } = useContext(ScheduleContext);

    const isMobile = useIsMobile();

    const [ activeShift, upcomingShift, shiftCount, showTicketCard ] = useMemo(() => {
        let activeShift: VolunteerShiftInfo | undefined;
        let upcomingShift: VolunteerShiftInfo | undefined;

        if (!schedule)
            return [ activeShift, upcomingShift, /* shiftCount= */ 0, /* showTicketCard= */ false ];

        const hasTicket = !!schedule.ticketBarcode;
        if (!Object.hasOwn(schedule.volunteers, `${schedule.userId}`))
            return [ activeShift, upcomingShift, /* shiftCount= */ 0, hasTicket ];

        const currentTime = currentTimestamp();
        const volunteer = schedule.volunteers[`${schedule.userId}`];

        let firstShiftStart: number | undefined;
        let firstShiftEnd: number | undefined;

        for (const scheduledShiftId of volunteer.schedule) {
            const scheduledShift = schedule.schedule[scheduledShiftId];
            if (firstShiftStart === undefined || scheduledShift.start < firstShiftStart) {
                firstShiftStart = scheduledShift.start;
                firstShiftEnd = scheduledShift.end;
            }

            if (scheduledShift.end < currentTime)
                continue;  // this shift has already ended

            const shift = schedule.shifts[scheduledShift.shift];
            const activity = schedule.program.activities[shift.activity];

            let location: string = /* default= */ 'Volunteer Lounge';
            for (const timeslotId of activity.timeslots) {
                const timeslot = schedule.program.timeslots[timeslotId];
                const timeslotLocation = schedule.program.locations[timeslot.location];

                location = timeslotLocation.name;
            }

            if (scheduledShift.start <= currentTime) {
                activeShift = {
                    title: shift.name,
                    location,
                    description: shift.description,
                    startTime: scheduledShift.start,
                    endTime: scheduledShift.end,
                };
            } else {
                if (!!upcomingShift && upcomingShift.startTime < scheduledShift.start)
                    continue;  // a more recent upcoming shift has already been found

                upcomingShift = {
                    title: shift.name,
                    location,
                    startTime: scheduledShift.start,
                    endTime: scheduledShift.end,
                };
            }
        }

        const showTicketCard = hasTicket && (
            firstShiftEnd === undefined ||
            currentTime < firstShiftEnd + kTicketCardVisibilityGraceSeconds
        );

        return [ activeShift, upcomingShift, volunteer.schedule.length, showTicketCard ];

    }, [ schedule ]);

    return (
        <>
            <SetTitle title={schedule?.event || 'AnimeCon'} />
            { (!!schedule?.config.enableHelpRequests && !!schedule?.helpRequestsPending) &&
                <HelpRequestsUrgentCard pending={schedule.helpRequestsPending}
                                        slug={schedule.slug} /> }
            { (!activeShift && !upcomingShift && shiftCount > 0) && <JobCompletedCard /> }
            { (!!activeShift && !!schedule) &&
                <ActiveShiftCard shift={activeShift} slug={schedule.slug} /> }
            { (!!upcomingShift && !!schedule) &&
                <UpcomingShiftCard shift={upcomingShift} slug={schedule.slug} /> }
            { (!!showTicketCard && !!schedule) &&
                <TicketCard event={schedule.event} slug={schedule.slug} /> }
            { /* TODO: Available back-up volunteers */ }
            { /* TODO: Available senior volunteers */ }
            { (!!isMobile && !!schedule?.dutyBooks?.length) &&
                schedule.dutyBooks.map(dutyBook => (
                    <DutyBookCard key={dutyBook.team}
                                  event={schedule.event}
                                  slug={schedule.slug}
                                  team={dutyBook.team}
                                  teamName={schedule.dutyBooks!.length > 1
                                      ? dutyBook.name
                                      : undefined}
                                  unread={dutyBook.unread} />
                )) }
            { (!!isMobile && !!schedule?.knowledge?.length) &&
                <KnowledgeBaseCard slug={schedule.slug} /> }
            { (!!isMobile && !!schedule?.config.enableHelpRequests) &&
                <HelpRequestsCard pending={schedule?.helpRequestsPending}
                                  slug={schedule.slug} /> }
            { !!schedule?.vendors[kVendorTeam.FirstAid] &&
                <OverviewVendorCard team={kVendorTeam.FirstAid} /> }
            { !!schedule?.vendors[kVendorTeam.Security] &&
                <OverviewVendorCard team={kVendorTeam.Security} /> }
            { !!schedule?.nardo &&
                <NardoAdviceCard advice={schedule.nardo} slug={schedule.slug}
                                 clickthrough={!!schedule.config.enableGeneratedAdvice} /> }
        </>
    );
}
