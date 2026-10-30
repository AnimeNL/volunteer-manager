// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, redirect } from 'next/navigation';

import { SelectElement, TextareaAutosizeElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import type { ShiftDemandTeamInfo } from './ShiftDemandTimeline';
import type { TimelineEvent } from '@AnimeNL/volunteer-manager-timeline';
import { ColorInput } from '@app/admin/components/ColorInput';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { ScheduledShiftsSection } from './ScheduledShiftsSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShiftDemandSection } from './ShiftDemandSection';
import { ShiftSettingsForm } from '../ShiftSettingsForm';
import { ShiftTeamVisibilityContext } from './ShiftTeamVisibilityContext';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getShiftMetadata } from '../getShiftMetadata';
import { readSetting } from '@lib/Settings';
import { readUserSetting } from '@lib/UserSettings';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tActivitiesTimeslots, tSchedule, tShifts, tShiftsCategories, tTeams, tUsers, tUsersEvents }
    from '@lib/database';

import { kExcitementOptions } from '@app/admin/components/ExcitementIcon';
import { kRegistrationStatus } from '@lib/database/Types';
import { kShiftDemand } from '../ShiftDemandSchema';

import { updateShift, updateShiftDemand, updateTeamVisibility } from '../ShiftActions';

/**
 * Options available for expected shift overlap. Warnings will be based on this option.
 */
const kOverlapOptions = [
    { id: 'None', label: 'No overlap with timeslots is required' },
    { id: 'Partial', label: 'All timeslots need partial coverage' },
    { id: 'Cover', label: 'All timeslots need full coverage' },
];

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
export default async function EventTeamShiftInformationPage(
    props: PageProps<'/admin/events/[event]/[team]/shifts/[id]'>)
{
    const { access, event, team, user } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.shifts',
        operation: 'read',
    });

    if (!team.flags.enableScheduling)
        notFound();

    const dbInstance = db;
    const params = await props.params;

    const shiftId = parseInt(params.id, /* radix= */ 10);
    if (!Number.isSafeInteger(shiftId))
        notFound();

    // ---------------------------------------------------------------------------------------------

    const shift = await dbInstance.selectFrom(tShifts)
        .innerJoin(tShiftsCategories)
            .on(tShiftsCategories.shiftCategoryId.equals(tShifts.shiftCategoryId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tShifts.teamId))
        .where(tShifts.shiftId.equals(shiftId))
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

    const teamDemandInfo = {
        colour: team.color,
        plural: team.plural,
        slug: team.slug,
    };

    const step = await readSetting('schedule-time-step-minutes');
    const includeAllTeams =
        !!await readUserSetting(user.id, 'user-admin-shifts-display-other-teams');

    // ---------------------------------------------------------------------------------------------
    // Compose the information required for the Volunteering Demand section. This combines timeslots
    // sourced from the festival program, shifts from the `team`, and shifts from other teams.
    // ---------------------------------------------------------------------------------------------

    const demand: TimelineEvent[] = demandToTimelineEvents(shift.demand, teamDemandInfo, true);

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

    const readOnly =
        !access.can('volunteers.shifts', 'update', { event: event.slug, team: team.slug });

    const updateShiftFn =
        readOnly ? undefined!
                 : updateShift.bind(null, event.slug, team.slug, shift.id);

    const updateShiftDemandFn =
        readOnly ? undefined!
                 : updateShiftDemand.bind(null, event.slug, team.slug, shift.id);

    const updateShiftDefaultValues = {
        ...shift,
        type: !!shift.activityId ? 'program' : 'initiative',
    };

    const { activities, categories, locations } = await getShiftMetadata(
        event.integrations?.anPlanFestivalId);

    return (
        <>
            <Section icon={ <PendingActionsIcon color="primary" /> }
                     title={`${shift.name} shift`} limited={readOnly}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Shifts',
                             href: `/admin/events/${event.slug}/${team.slug}/shifts`
                         },
                         { label: shift.name },
                     ]}>
                <SectionIntroduction>
                    Manage and analyse this shift part of {event.shortName} planning.
                </SectionIntroduction>
            </Section>
            <FormGridSection icon={ <SettingsOutlinedIcon /> } title="Settings"
                             action={updateShiftFn} defaultValues={updateShiftDefaultValues}>
                <Grid size={{ xs: 12 }}>
                    <SectionIntroduction>
                        Identity and association of the shift. These details will be shared with
                        volunteers.
                    </SectionIntroduction>
                </Grid>
                <ShiftSettingsForm activities={activities} categories={categories}
                                   locations={locations} includeName readOnly={readOnly} />
                <Grid size={{ xs: 6 }}>
                    <SelectElement name="excitement" label="Excitement level" fullWidth required
                                   options={kExcitementOptions} size="small" type="number"
                                   disabled={readOnly} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <ColorInput name="colour" label="Override colour" fullWidth size="small"
                                disabled={readOnly} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="overlap" label="Timeslot overlap" fullWidth required
                                   options={kOverlapOptions} size="small" disabled={readOnly} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextareaAutosizeElement name="description" label="Description" multiline
                                             size="small" fullWidth disabled={readOnly} />
                </Grid>
            </FormGridSection>
            <ShiftTeamVisibilityContext action={updateTeamVisibility}
                                        includeAllTeams={includeAllTeams}>
                <Section icon={ <MoreTimeOutlinedIcon /> } title="Volunteering demand">
                    <SectionIntroduction>
                        What are the expectations, assuming ideal conditions, on the presence of
                        volunteers during {event.shortName}?
                    </SectionIntroduction>
                    <ShiftDemandSection demand={demand} shiftId={shift.id} step={step}
                                        readOnly={readOnly} team={teamDemandInfo}
                                        action={updateShiftDemandFn} event={{
                                            startTime: event.startTime.toString(),
                                            endTime: event.endTime.toString(),
                                            timezone: event.timeZone,
                                        }} />
                </Section>
                <Section icon={ <ScheduleIcon /> } title="Schedule">
                    <SectionIntroduction>
                        Overview of when volunteers have been scheduled on this shift.
                    </SectionIntroduction>
                    <ScheduledShiftsSection shifts={scheduled} teamId={team.id}
                                            event={{
                                                startTime: event.startTime.toString(),
                                                endTime: event.endTime.toString(),
                                                timezone: event.timeZone,
                                            }} />
                </Section>
            </ShiftTeamVisibilityContext>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Shift details', 'Shifts', { team: 'team' }, { event: 'event' });
