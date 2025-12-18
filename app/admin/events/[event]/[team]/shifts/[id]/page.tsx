// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound, redirect } from 'next/navigation';

import type { ShiftDemandTeamInfo } from './ShiftDemandTimeline';
import type { TimelineEvent } from '@beverloo/volunteer-manager-timeline';
import { CollapsableSection } from '@app/admin/components/CollapsableSection';
import { ScheduledShiftsSection } from './ScheduledShiftsSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShiftDemandSection } from './ShiftDemandSection';
import { ShiftSettingsSection } from './ShiftSettingsSection';
import { ShiftTeamVisibilityContext } from './ShiftTeamVisibilityContext';
import { generateEventMetadataFn } from '../../../generateEventMetadataFn';
import { getShiftMetadata } from '../getShiftMetadata';
import { readSetting } from '@lib/Settings';
import { readUserSettings } from '@lib/UserSettings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tActivitiesTimeslots, tSchedule, tShifts, tShiftsCategories, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';
import { kShiftDemand } from '@app/api/admin/event/shifts/[[...id]]/demand';

/**
 * Converts the given `demandStr`, assuming that it is valid, to a series of `TimelineEvent` entries
 * for the given `team`. The events will be immutable unless `editable` is set.
 */
function demandToTimelineEvents(
    demandStr: string | undefined, team: ShiftDemandTeamInfo, editable?: boolean): TimelineEvent[]
{
    const timelineEvents: TimelineEvent[] = [];
    if (!!demandStr && demandStr.length > 4) {
        try {
            const demand = JSON.parse(demandStr);
            const label = {
                singular: team.plural.replace(/s$/, ''),
                plural: team.plural,
            };

            kShiftDemand.parse(demand);  // throws on invalid data

            for (const { start, end, volunteers } of demand) {
                timelineEvents.push({
                    id: `${team.slug}/${timelineEvents.length}`,
                    start, end, editable,
                    color: team.colour,
                    title: `${volunteers} ${volunteers === 1 ? label.singular : label.plural}`,

                    // Internal information:
                    animeConLabel: label,
                    volunteers,
                });
            }
        } catch (error: any) {
            console.warn(`Unable to parse demand for ${team}: ${error.message}`);
        }
    }

    return timelineEvents;
}

/**
 * This page displays an individual shift, its configuration, time allocation and warnings. The
 * actual volunteers cannot be adjusted; this is something that has to be done on the schedule page.
 */
export default async function EventTeamShiftPage(
    props: PageProps<'/admin/events/[event]/[team]/shifts/[id]'>)
{
    const { access, event, team, user } = await verifyAccessAndFetchPageInfo(props.params);

    if (!access.can('event.shifts', 'read', { event: event.slug, team: team.slug }))
        forbidden();

    if (!team.flagEnableScheduling)
        notFound();

    const readOnly = !access.can('event.shifts', 'update', { event: event.slug, team: team.slug });
    const warnings: any[] = [ ];

    const step = await readSetting('schedule-time-step-minutes');
    const userSettings = await readUserSettings(user.id, [
        'user-admin-shifts-display-other-teams',
        'user-admin-shifts-expand-shifts',
    ]);

    const expandSchedule = userSettings['user-admin-shifts-expand-shifts'] ?? false;
    const includeAllTeams = userSettings['user-admin-shifts-display-other-teams'] ?? false;
    const params = await props.params;

    // ---------------------------------------------------------------------------------------------

    const dbInstance = db;
    const shift = await dbInstance.selectFrom(tShifts)
        .innerJoin(tShiftsCategories)
            .on(tShiftsCategories.shiftCategoryId.equals(tShifts.shiftCategoryId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tShifts.teamId))
        .where(tShifts.shiftId.equals(parseInt(params.id, /* radix= */ 10)))
            .and(tShifts.eventId.equals(event.id))
            .and(tShifts.shiftDeleted.isNull())
        .select({
            id: tShifts.shiftId,
            name: tShifts.shiftName,
            team: tTeams.teamSlug,
            category: tShiftsCategories.shiftCategoryName,
            categoryId: tShiftsCategories.shiftCategoryId,
            categoryOrder: tShiftsCategories.shiftCategoryOrder,
            colour: tShifts.shiftColour,
            activityId: tShifts.shiftActivityId,
            locationId: tShifts.shiftLocationId,
            description: tShifts.shiftDescription,
            overlap: tShifts.shiftDemandOverlap,
            demand: tShifts.shiftDemand,
            excitement: tShifts.shiftExcitement,
        })
        .executeSelectNoneOrOne();

    if (!shift)
        notFound();

    if (shift.team !== team.slug)
        redirect(`../../${shift.team}/shifts/${shift.id}`);

    // ---------------------------------------------------------------------------------------------
    // Compose the information required for the Volunteering Demand section. This combines timeslots
    // sourced from the festival program, shifts from the `team`, and shifts from other teams.
    // ---------------------------------------------------------------------------------------------

    const demand: TimelineEvent[] = demandToTimelineEvents(shift.demand, team, /*editable=*/ true);
    const shiftsForActivity = new Set([ shift.id ]);

    if (!!shift.activityId) {
        const timeslots = await dbInstance.selectFrom(tActivitiesTimeslots)
            .where(tActivitiesTimeslots.activityId.equals(shift.activityId))
                .and(tActivitiesTimeslots.timeslotDeleted.isNull())
            .select({
                id: tActivitiesTimeslots.timeslotId,
                start: tActivitiesTimeslots.timeslotStartTime,
                end: tActivitiesTimeslots.timeslotEndTime,
            })
            .executeSelectMany();

        for (const { id, start, end } of timeslots) {
            demand.push({
                id: `timeslot/${id}`,
                start: start.toString({ timeZoneName: 'never' }),
                end: end.toString({ timeZoneName: 'never' }),
                color: '#ffeb3b',
                editable: false,  // timeslots cannot be modified
                title: 'Timeslot',
            });
        }

        const externalDemand = await dbInstance.selectFrom(tShifts)
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tShifts.teamId))
            .where(tShifts.eventId.equals(event.id))
                .and(tShifts.shiftActivityId.equals(shift.activityId))
                .and(tShifts.shiftId.notEquals(shift.id))
            .select({
                shiftId: tShifts.shiftId,
                shiftDemand: tShifts.shiftDemand,
                team: {
                    colour: tTeams.teamColourLightTheme,
                    plural: tTeams.teamPlural,
                    slug: tTeams.teamSlug,
                },
            })
            .executeSelectMany();

        for (const { shiftId, shiftDemand, team } of externalDemand) {
            demand.push(...demandToTimelineEvents(shiftDemand, team, /* editable= */ false));
            shiftsForActivity.add(shiftId);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Compose the information regarding volunteers who actually have been scheduled on this shift,
    // again, across the different teams. The associated section will only be presented when at
    // least one shift has been scheduled.
    // ---------------------------------------------------------------------------------------------

    const scheduled: TimelineEvent[] = [];
    const scheduledShifts = await dbInstance.selectFrom(tSchedule)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tSchedule.userId))
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.userId.equals(tSchedule.userId))
                .and(tUsersEvents.eventId.equals(tSchedule.eventId))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tSchedule.shiftId.in([ ...shiftsForActivity ]))
            .and(tSchedule.scheduleDeleted.isNull())
        .select({
            id: tSchedule.scheduleId,
            start: tSchedule.scheduleTimeStart,
            end: tSchedule.scheduleTimeEnd,
            color: tTeams.teamColourLightTheme,
            title: tUsers.name,

            // Internal information to provide filtering and linkification capabilities:
            animeConTeam: tTeams.teamSlug,
            animeConTeamId: tTeams.teamId,
            animeConUserId: tUsers.userId,
        })
        .executeSelectMany();

    for (const scheduledShift of scheduledShifts) {
        scheduled.push({
            ...scheduledShift,
            start: scheduledShift.start.toString({ timeZoneName: 'never' }),
            end: scheduledShift.end.toString({ timeZoneName: 'never' }),
        });
    }

    // ---------------------------------------------------------------------------------------------

    const { activities, categories, locations } = await getShiftMetadata(event.festivalId);

    return (
        <>
            <Section title={`${shift.name} shift`} subtitle={team.name}>
                <ShiftSettingsSection activities={activities} categories={categories}
                                      context={{ event: event.slug, team: team.slug }}
                                      locations={locations} readOnly={readOnly} shift={shift} />
            </Section>
            <ShiftTeamVisibilityContext includeAllTeams={includeAllTeams}>
                <Section title="Volunteering demand">
                    <SectionIntroduction important={!demand.length}>
                        Indicate what the agreed volunteering demand for this shift is: how many
                        people are expected to be scheduled on this shift, and when.
                    </SectionIntroduction>
                    <ShiftDemandSection event={event} readOnly={readOnly} demand={demand}
                                        shiftId={shift.id} step={step} team={team} />
                </Section>
                <CollapsableSection in={!!warnings.length} title="Shift warnings">
                    <SectionIntroduction important>
                        The shifts tool has not been implemented yet.
                    </SectionIntroduction>
                </CollapsableSection>
                { !!scheduled.length &&
                    <ScheduledShiftsSection defaultExpanded={expandSchedule}
                                            event={event} shifts={scheduled} teamId={team.id} /> }
            </ShiftTeamVisibilityContext>
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Shifts');
