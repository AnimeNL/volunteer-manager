// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { determineAvailability } from './fn/determineAvailability';
import { executeServerAction } from '@lib/serverAction';
import { getShiftsForEvent } from '@app/admin/lib/getShiftsForEvent';
import { getTimeslots } from './fn/getTimeslots';
import { getTimeslotsForShifts } from './fn/getTimeslotsForShifts';
import { isAfter } from '@lib/Temporal';
import { isValidShift } from './fn/isValidShift';
import { readSettings } from '@lib/Settings';
import { requireAuthentication, requireAuthenticationWithEventAndTeam }
    from '@lib/requireAuthentication';
import { validateTime } from './fn/validateTime';
import { writeUserSetting, writeUserSettings } from '@lib/UserSettings';
import db, { tRoles, tSchedule, tScheduleLogs, tUsers, tUsersEvents,
    tUsersEventsPreferencesAvailability } from '@lib/database';

import type { kServiceHoursProperty } from '@app/registration/[slug]/application/ApplicationActions';
import { kMutation, kRegistrationStatus } from '@lib/database/Types';
import { kTemporalPlainDate, kTemporalZonedDateTime } from '@app/admin/lib/ZodTransformers';

/**
 * Zod schema describing the shift payload for creating or updating a schedule entry.
 */
const kScheduleShiftData = z.object({
    /**
     * User ID of the volunteer to whom the shift belongs.
     */
    userId: z.number(),

    /**
     * Unique ID of the defined shift, as it exists in the database.
     */
    shiftId: z.number().optional(),

    /**
     * Time at which the shift will start.
     */
    start: kTemporalZonedDateTime,

    /**
     * Time at which the shift will finish.
     */
    end: kTemporalZonedDateTime,
});

/**
 * Server Action that allows leaders to create a new schedule entry.
 */
export async function createScheduleEntry(eventSlug: string, teamSlug: string, shiftData: unknown) {
    return executeServerAction(shiftData, kScheduleShiftData, async (shift, props) => {
        const { event, team, user } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'volunteers.schedules',
                operation: 'update',
            });

        if (!isAfter(shift.end, shift.start)) {
            return {
                success: false,
                error: 'The shift ends before it starts. Please tell Peter how you did this!',
            };
        }

        const availabilityPreferencesJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();

        const dbInstance = db;
        const volunteer = await dbInstance.selectFrom(tUsersEvents)
            .leftJoin(availabilityPreferencesJoin)
                .on(availabilityPreferencesJoin.userId.equals(tUsersEvents.userId))
                    .and(availabilityPreferencesJoin.eventId.equals(tUsersEvents.eventId))
                    .and(availabilityPreferencesJoin.teamId.equals(tUsersEvents.teamId))
                    .and(availabilityPreferencesJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
            .where(tUsersEvents.userId.equals(shift.userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                id: tUsersEvents.userId,
                availabilityExceptions: availabilityPreferencesJoin.availabilityExceptions,
                availabilityTimeslots: availabilityPreferencesJoin.availabilityTimeslots,
            })
            .executeSelectNoneOrOne();

        if (!volunteer)
            return { success: false, error: 'The selected volunteer is not part of this team' };

        const valid = await isValidShift(event, volunteer, shift);
        if (!valid) {
            return {
                success: false,
                error: 'Cannot schedule a shift at that time for the volunteer',
            };
        }

        await dbInstance.transaction(async () => {
            const scheduleId = await dbInstance.insertInto(tSchedule)
                .set({
                    userId: volunteer.id,
                    eventId: event.id,
                    shiftId: shift.shiftId,
                    scheduleTimeStart: shift.start,
                    scheduleTimeEnd: shift.end,
                    scheduleUpdatedBy: user.id,
                    scheduleUpdated: dbInstance.currentZonedDateTime(),
                })
                .returningLastInsertedId()
                .executeInsert();

            await dbInstance.insertInto(tScheduleLogs)
                .set({
                    eventId: event.id,
                    scheduleId,
                    mutation: kMutation.Created,
                    mutationAfterShiftId: shift.shiftId,
                    mutationAfterTimeStart: shift.start,
                    mutationAfterTimeEnd: shift.end,
                    mutationAfterUserId: volunteer.id,
                    mutationUserId: user.id,
                })
                .executeInsert();
        });

        return { success: true };
    });
}

/**
 * Zod schema describing the schedule entry ID to delete.
 */
const kDeleteScheduleEntryData = z.object({
    id: z.union([ z.number(), z.string() ]),
});

/**
 * Server Action that allows leaders to delete a schedule entry.
 */
export async function deleteScheduleEntry(
    eventSlug: string, teamSlug: string, id: number | string)
{
    return executeServerAction({ id }, kDeleteScheduleEntryData, async (data, props) => {
        const { event, user } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'volunteers.schedules',
                operation: 'update',
            });

        const scheduleId = typeof data.id === 'number' ? data.id : parseInt(data.id, 10);
        if (!Number.isSafeInteger(scheduleId))
            return { success: false, error: 'The selected shift has not been saved yet' };

        const dbInstance = db;
        const scheduledShift = await dbInstance.selectFrom(tSchedule)
            .where(tSchedule.scheduleId.equals(scheduleId))
                .and(tSchedule.eventId.equals(event.id))
            .select({
                shiftId: tSchedule.shiftId,
                timeStart: tSchedule.scheduleTimeStart,
                timeEnd: tSchedule.scheduleTimeEnd,
                userId: tSchedule.userId,
            })
            .executeSelectNoneOrOne();

        if (!scheduledShift)
            notFound();

        const affectedRows = await dbInstance.transaction(async () => {
            const affectedRows = await dbInstance.update(tSchedule)
                .set({
                    scheduleDeleted: dbInstance.currentZonedDateTime(),
                })
                .where(tSchedule.scheduleId.equals(scheduleId))
                    .and(tSchedule.eventId.equals(event.id))
                .executeUpdate();

            if (!!affectedRows) {
                await dbInstance.insertInto(tScheduleLogs)
                    .set({
                        eventId: event.id,
                        scheduleId,
                        mutation: kMutation.Deleted,
                        mutationBeforeShiftId: scheduledShift.shiftId,
                        mutationBeforeTimeStart: scheduledShift.timeStart,
                        mutationBeforeTimeEnd: scheduledShift.timeEnd,
                        mutationBeforeUserId: scheduledShift.userId,
                        mutationUserId: user.id,
                    })
                    .executeInsert();
            }

            return affectedRows;
        });

        return { success: !!affectedRows };
    });
}

/**
 * Zod schema describing the data for updating a schedule entry.
 */
const kUpdateScheduleEntryData = z.object({
    id: z.union([ z.number(), z.string() ]),
    shift: kScheduleShiftData,
});

/**
 * Server Action that allows leaders to update a schedule entry.
 */
export async function updateScheduleEntry(
    eventSlug: string, teamSlug: string, id: number | string, shiftData: unknown)
{
    return executeServerAction(
        { id, shift: shiftData }, kUpdateScheduleEntryData, async (data, props) =>
    {
        const { event, team, user } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'volunteers.schedules',
                operation: 'update',
            });

        const scheduleId = typeof data.id === 'number' ? data.id : parseInt(data.id, 10);
        if (!Number.isSafeInteger(scheduleId))
            return { success: false, error: 'The selected shift has not been saved yet' };

        const dbInstance = db;
        const shift = await dbInstance.selectFrom(tSchedule)
            .where(tSchedule.scheduleId.equals(scheduleId))
                .and(tSchedule.eventId.equals(event.id))
                .and(tSchedule.scheduleDeleted.isNull())
            .select({
                userId: tSchedule.userId,
                shiftId: tSchedule.shiftId,
                start: tSchedule.scheduleTimeStart,
                end: tSchedule.scheduleTimeEnd,
            })
            .executeSelectNoneOrOne();

        if (!shift)
            return { success: false, error: 'The selected shift does not exist anymore' };

        const availabilityPreferencesJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();

        const volunteer = await dbInstance.selectFrom(tUsersEvents)
            .leftJoin(availabilityPreferencesJoin)
                .on(availabilityPreferencesJoin.userId.equals(tUsersEvents.userId))
                    .and(availabilityPreferencesJoin.eventId.equals(tUsersEvents.eventId))
                    .and(availabilityPreferencesJoin.teamId.equals(tUsersEvents.teamId))
                    .and(availabilityPreferencesJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
            .where(tUsersEvents.userId.equals(data.shift.userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                id: tUsersEvents.userId,
                availabilityExceptions: availabilityPreferencesJoin.availabilityExceptions,
                availabilityTimeslots: availabilityPreferencesJoin.availabilityTimeslots,
            })
            .executeSelectNoneOrOne();

        if (!volunteer)
            return { success: false, error: 'The selected volunteer is not part of this team' };

        if (!isAfter(data.shift.end, data.shift.start)) {
            return {
                success: false,
                error: 'The shift ends before it starts. Please tell Peter how you did this!',
            };
        }

        const valid = await isValidShift(event, volunteer, data.shift, /* ignoreShift= */ scheduleId);
        if (!valid) {
            return {
                success: false,
                error: 'Cannot schedule a shift at that time for the volunteer',
            };
        }

        const affectedRows = await dbInstance.transaction(async () => {
            const affectedRows = await dbInstance.update(tSchedule)
                .setIfValue({
                    shiftId: data.shift.shiftId,
                })
                .set({
                    userId: data.shift.userId,
                    scheduleTimeStart: data.shift.start,
                    scheduleTimeEnd: data.shift.end,
                    scheduleUpdatedBy: user.id,
                    scheduleUpdated: dbInstance.currentZonedDateTime(),
                })
                .where(tSchedule.scheduleId.equals(scheduleId))
                    .and(tSchedule.eventId.equals(event.id))
                .executeUpdate();

            if (!!affectedRows) {
                const mutationBeforeShiftId = shift.shiftId;
                let mutationAfterShiftId: number | undefined;

                if (shift.shiftId !== data.shift.shiftId)
                    mutationAfterShiftId = data.shift.shiftId;

                let mutationBeforeTimeStart: Temporal.ZonedDateTime | undefined;
                let mutationBeforeTimeEnd: Temporal.ZonedDateTime | undefined;
                let mutationAfterTimeStart: Temporal.ZonedDateTime | undefined;
                let mutationAfterTimeEnd: Temporal.ZonedDateTime | undefined;

                if (Temporal.ZonedDateTime.compare(shift.start, data.shift.start) !== 0) {
                    mutationBeforeTimeStart = shift.start;
                    mutationAfterTimeStart = data.shift.start;
                }

                if (Temporal.ZonedDateTime.compare(shift.end, data.shift.end) !== 0) {
                    mutationBeforeTimeEnd = shift.end;
                    mutationAfterTimeEnd = data.shift.end;
                }

                const mutationBeforeUserId = shift.userId;
                let mutationAfterUserId: number | undefined;

                if (shift.userId !== data.shift.userId)
                    mutationAfterUserId = data.shift.userId;

                await dbInstance.insertInto(tScheduleLogs)
                    .set({
                        eventId: event.id,
                        scheduleId,
                        mutation: kMutation.Updated,
                        mutationBeforeShiftId,
                        mutationBeforeTimeStart,
                        mutationBeforeTimeEnd,
                        mutationBeforeUserId,
                        mutationAfterShiftId,
                        mutationAfterTimeStart,
                        mutationAfterTimeEnd,
                        mutationAfterUserId,
                        mutationUserId: user.id,
                    })
                    .executeInsert();
            }

            return affectedRows;
        });

        return { success: !!affectedRows };
    });
}

/**
 * Zod schema describing the user settings that can be persisted for the schedule tool.
 */
const kUpdateScheduleSettingsData = z.object({
    date: z.string().optional(),
    expandSections: z.string().optional(),
    inclusiveShifts: z.boolean().optional(),
});

/**
 * Server Action through which user settings for the schedule tool can be persisted.
 */
export async function updateScheduleSettings(
    settings: z.infer<typeof kUpdateScheduleSettingsData>)
{
    return executeServerAction(settings, kUpdateScheduleSettingsData, async (data, props) => {
        await requireAuthentication(props.authenticationContext);

        const updates: Record<string, string | boolean | undefined> = {};
        if (data.date !== undefined)
            updates['user-admin-schedule-date'] = data.date;
        if (data.expandSections !== undefined)
            updates['user-admin-schedule-expand-sections'] = data.expandSections;
        if (data.inclusiveShifts !== undefined)
            updates['user-admin-schedule-inclusive-shifts'] = data.inclusiveShifts;

        if (Object.keys(updates).length > 0)
            await writeUserSettings(props.user.id, updates as any);

        return { success: true };
    });
}

/**
 * Valid options for the number of hours volunteers are willing to work, with the range of hours
 * that roughly maps to those indicated values.
 */
const kServiceHoursOptions: { [k in z.infer<typeof kServiceHoursProperty>]: [ number, number ] } = {
    '12': [ 8, 12 ],
    '16': [ 12, 16 ],
    '20': [ 16, 20 ],
    '24': [ 20, 40 ],
} as const;

/**
 * Type that describes the contents of a schedule as it will be consumed by the client.
 */
export interface GetScheduleResult {
    /**
     * Minimum time that should be displayed on the timeline.
     */
    min: string;

    /**
     * Maximum time that should be displayed on the timeline.
     */
    max: string;

    /**
     * Markers that should be added to the schedule. These are used to indicate when individual
     * volunteers are not available, or when shifts should be avoided.
     */
    markers: {
        /**
         * Unique ID of the marker.
         */
        id: string;

        /**
         * Date and time at which the marker should start.
         */
        start: string;

        /**
         * Date and time at which the marker should end.
         */
        end: string;

        /**
         * Unique ID of the volunteer for whom this marker has been created.
         */
        resource: number | number[];

        /**
         * Type of marker that should be added to the schedule.
         */
        type: 'avoid' | 'unavailable' | 'highlight-demand' | 'highlight-timeslot';
    }[];

    /**
     * Metadata specific to this event, but not per se to the schedule that's being displayed.
     */
    metadata: {
        /**
         * Recent shifts (included in `shifts`) that the signed in volunteer recently touched.
         */
        recent: number[];

        /**
         * Shifts that exist for the event, across teams.
         */
        shifts: {
            /**
             * Unique ID of the shift as it exists in the database.
             */
            id: number;

            /**
             * Label of the shift, as it should be presented.
             */
            label: string;

            /**
             * Colour in which the shift should be displayed on the schedule.
             */
            color: string;

            /**
             * Whether the shift is part of the local team, or of one of the partnering teams.
             * @deprecated
             */
            localTeam: boolean;

            /**
             * Status of the shift, i.e. has everything been scheduled already?
             */
            status?: 'error' | 'warning' | 'complete';

            /**
             * URL-safe slug of the team who owns this particular shift.
             */
            team: string;

            /**
             * Optional warning that should be displayed in the shift listing.
             */
            warning?: string;
        }[];

        /**
         * Teams for which shifts may appear on the schedule. Record keyed by the team's slug, and
         * valued with the team's name and colour.
         */
        teams: Record<string, {
            /**
             * Colour of the team, to enable the volunteering lead to quick scan.
             */
            color: string;

            /**
             * Label of the team, should be crisp (prefer "Crew" over "Volunteering Crew").
             */
            label: string;
        }>;
    };

    /**
     * The resources that should be shown on the schedule. Resources are volunteers, grouped by the
     * role that they have been assigned to, and then shown in alphabetical order.
     */
    resources: {
        /**
         * Unique ID of the role that has been assigned to a volunteer.
         */
        id: string;

        /**
         * Name of the role as it should be presented.
         */
        name: string;

        /**
         * Volunteers who are part of this role, in alphabetical order.
         */
        children: {
            /**
             * Unique ID that represents the volunteer as they exist in the database.
             */
            id: number;

            /**
             * Name of the volunteer, as they should be referred to.
             */
            name: string;

            /**
             * Whether this is the first time that the resource helps us out.
             */
            new: boolean;

            /**
             * The volunteer's preferred number of hours as an array of minimum and maximum.
             */
            preferredHours?: [ number, number ];
        }[];

        /**
         * Whether the row should be collapsed by default.
         */
        collapsed: boolean;
    }[];

    /**
     * The shifts that have been scheduled on the timeline. Each must carry a moment at which they
     * start and end, a title and a colour.
     */
    shifts: {
        /**
         * Unique ID of the scheduled shift as it exists in the database.
         */
        id: number;

        /**
         * Unique ID of the defined shift as it exists in the database.
         */
        shiftId?: number;

        /**
         * Date and time at which the shift starts.
         */
        start: string;

        /**
         * Date and time at which the shift ends.
         */
        end: string;

        /**
         * Title of the shift, as it should be presented.
         */
        title: string;

        /**
         * Colour in which the shift should be displayed on the schedule.
         */
        color: string;

        /**
         * Unique ID of the volunteer for whom this shift exists.
         */
        resource: number;

        /**
         * When set, time scheduled for this shift will not count towards total contribution.
         */
        noContribution?: true;
    }[];

    /**
     * Timezone in which the event will be taking place.
     */
    timezone: string;
}

/**
 * Input that should be given in order to determine the date range.
 */
type DateRangeInput = {
    date?: Temporal.PlainDate;
    event: {
        startTime: Temporal.ZonedDateTime;
        endTime: Temporal.ZonedDateTime;
        timeZone: string;
    };
    settings: {
        'schedule-day-view-start-time'?: string;
        'schedule-day-view-end-time'?: string;
        'schedule-event-view-start-hours'?: number;
        'schedule-event-view-end-hours'?: number;
    };
};

/**
 * Determines the date range for the schedule view. This is dependent on the dates during which the
 * event will be taking place, and whether the schedule for an individual day has been requested.
 */
function determineDateRange(input: DateRangeInput) {
    if (!!input.date) {
        const startOfDay = input.date.toZonedDateTime({
            timeZone: input.event.timeZone,
            plainTime: '00:00:00',
        });

        const startTime = validateTime(input.settings['schedule-day-view-start-time'], '08:00');
        const endTime = validateTime(input.settings['schedule-day-view-end-time'], '27:30');

        const [ startHours, startMinutes ] = startTime.split(':').map(v => parseInt(v, 10));
        const [ endHours, endMinutes ] = endTime.split(':').map(v => parseInt(v, 10));

        return {
            min: startOfDay.add({ hours: startHours, minutes: startMinutes }),
            max: startOfDay.add({ hours: endHours, minutes: endMinutes }),
        };
    }

    const startHours = input.settings['schedule-event-view-start-hours'] ?? 4;
    const endHours = input.settings['schedule-event-view-end-hours'] ?? 2;

    return {
        min: input.event.startTime.subtract({ hours: startHours }),
        max: input.event.endTime.add({ hours: endHours }),
    };
}

/**
 * Merges duplicated markers contained within the `input` into a markers shared across multiple
 * resources. This is a performance optimisation to reduce the number of entities: for example, in
 * the 2024 Crew team this reduces the number of markers from 287 to 50 (-82.6%).
 */
function mergeDuplicateMarkers(input: GetScheduleResult['markers']) {
    const output: GetScheduleResult['markers'] = [ /* none yet */ ];
    const markerIndices: Map<string, number> = new Map;

    function getKeyForMarker(marker: GetScheduleResult['markers'][number]): string {
        return `${marker.type}-${marker.start}-${marker.end}`;
    }

    for (const marker of input) {
        const markerKey = getKeyForMarker(marker);
        const markerIndex = markerIndices.get(markerKey);

        if (markerIndex !== undefined) {
            if (!Array.isArray(output[markerIndex].resource))
                output[markerIndex].resource = [ output[markerIndex].resource ];

            output[markerIndex].resource.push(marker.resource as number);

        } else {
            markerIndices.set(markerKey, output.length);
            output.push(marker);
        }
    }

    return output;
}

/**
 * Zod schema describing optional filters when retrieving the schedule.
 */
const kGetScheduleData = z.object({
    /**
     * Optional date on which the schedule should focus, if any. Defaults to the entire event when
     * omitted.
     */
    date: kTemporalPlainDate.optional(),

    /**
     * Optional comma-separated list of shift IDs that should be highlighted.
     */
    highlights: z.string().optional(),
});

/**
 * Server Action that allows leaders to retrieve the schedule's current state. Optimised for being
 * called at a preconfigured interval, to avoid collisions between mutations.
 */
export async function getSchedule(
    eventSlug: string, teamSlug: string, options?: z.input<typeof kGetScheduleData>)
{
    return executeServerAction(options ?? {}, kGetScheduleData, async (data, props) => {
        const { event, team, user } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'volunteers.schedules',
                operation: 'read',
            });

        const settings = await readSettings([
            'schedule-day-view-start-time',
            'schedule-day-view-end-time',
            'schedule-event-view-start-hours',
            'schedule-event-view-end-hours',
            'schedule-recent-shift-count',
        ]);

        const { min, max } = determineDateRange({ date: data.date, event, settings });

        const schedule: GetScheduleResult = {
            min: min.toString({ timeZoneName: 'never' }),
            max: max.toString({ timeZoneName: 'never' }),
            markers: [],
            metadata: {
                recent: [ /* empty */ ],
                shifts: [ /* empty */ ],
                teams: { /* empty */ },
            },
            resources: [],
            shifts: [],
            timezone: event.timeZone,
        };

        // -----------------------------------------------------------------------------------------
        // Retrieve information about the volunteers.
        // -----------------------------------------------------------------------------------------

        const festivalId = event.integrations?.anPlanFestivalId;

        const users: number[] = [];
        const timeslots = await getTimeslots(festivalId);

        const availabilityPreferencesJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();
        const usersEventsJoin = tUsersEvents.forUseInLeftJoinAs('oej');

        const dbInstance = db;
        const firstTimeVolunteers = new Set(await dbInstance.selectFrom(tUsersEvents)
            .leftJoin(usersEventsJoin)
                .on(usersEventsJoin.userId.equals(tUsersEvents.userId))
                    .and(usersEventsJoin.eventId.notEquals(tUsersEvents.eventId))
                    .and(usersEventsJoin.teamId.equals(tUsersEvents.teamId))
                    .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
            .where(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
                .and(usersEventsJoin.eventId.isNull())
            .selectOneColumn(tUsersEvents.userId)
            .executeSelectMany());

        const resources = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .leftJoin(availabilityPreferencesJoin)
                .on(availabilityPreferencesJoin.userId.equals(tUsersEvents.userId))
                    .and(availabilityPreferencesJoin.eventId.equals(tUsersEvents.eventId))
                    .and(availabilityPreferencesJoin.teamId.equals(tUsersEvents.teamId))
                    .and(availabilityPreferencesJoin.preferenceVersionIsLatest.equals(
                        /* true= */ 1))
            .where(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                id: tRoles.roleId,
                name: tRoles.roleName,

                children: dbInstance.aggregateAsArray({
                    id: tUsers.userId,
                    name: tUsers.name,
                    hours: availabilityPreferencesJoin.availabilityHours,
                    availabilityExceptions: availabilityPreferencesJoin.availabilityExceptions,
                    availabilityTimeslots: availabilityPreferencesJoin.availabilityTimeslots,
                    preferenceTimingStart: availabilityPreferencesJoin.availabilityTimingStart,
                    preferenceTimingEnd: availabilityPreferencesJoin.availabilityTimingEnd,
                }),

                collapsed: tRoles.roleScheduleCollapse,
            })
            .groupBy(tRoles.roleId)
            .orderBy(tRoles.roleOrder, 'asc')
            .executeSelectMany();

        const humanResources: number[] = [ /* none yet */ ];

        for (const roleResource of resources) {
            const roleId = `role/${roleResource.id}`;

            const children: GetScheduleResult['resources'][number]['children'] = [];
            for (const humanResource of roleResource.children) {
                const { avoid, unavailable } = determineAvailability({
                    event: {
                        startTime: event.startTime,
                        endTime: event.endTime,
                        timezone: event.timeZone,
                    },
                    settings,
                    timeslots,
                    volunteer: humanResource,
                });

                let volunteerMarkerId = 0;
                for (const { start, end } of avoid) {
                    schedule.markers.push({
                        id: `${humanResource.id}/m/a/${++volunteerMarkerId}`,
                        start: start.toString({ timeZoneName: 'never' }),
                        end: end.toString({ timeZoneName: 'never' }),
                        resource: humanResource.id,
                        type: 'avoid',
                    });
                }

                for (const { start, end } of unavailable) {
                    schedule.markers.push({
                        id: `${humanResource.id}/m/u/${++volunteerMarkerId}`,
                        start: start.toString({ timeZoneName: 'never' }),
                        end: end.toString({ timeZoneName: 'never' }),
                        resource: humanResource.id,
                        type: 'unavailable',
                    });
                }

                // TODO: Compute warnings

                humanResources.push(humanResource.id);

                let preferredHours: [ number, number ] | undefined;
                if (typeof humanResource.hours === 'number') {
                    const preferredHoursStr =
                        `${humanResource.hours}` as keyof typeof kServiceHoursOptions;

                    if (preferredHoursStr in kServiceHoursOptions)
                        preferredHours = kServiceHoursOptions[preferredHoursStr];
                }

                children.push({
                    id: humanResource.id,
                    name: humanResource.name,
                    ['new']: firstTimeVolunteers.has(humanResource.id),
                    preferredHours,
                });

                users.push(humanResource.id);
            }

            children.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

            schedule.resources.push({
                id: roleId,
                name: roleResource.name,
                children: children,
                collapsed: !!roleResource.collapsed,
            });
        }

        schedule.markers = mergeDuplicateMarkers(schedule.markers);

        if (!!data.highlights) {
            const highlights =
                data.highlights.split(',').map(v => parseInt(v, 10)).filter(Boolean);
            const highlightedShifts = await getTimeslotsForShifts(highlights);

            await writeUserSetting(
                user.id, 'user-admin-schedule-highlight-shifts', highlights.join(','));

            for (const { id, demand, timeslots } of highlightedShifts) {
                if (!!demand) {
                    let demandIndex = 0;
                    for (const { start, end } of demand) {
                        schedule.markers.push({
                            id: `highlights/${id}/d/${demandIndex++}`,
                            start: start,
                            end: end,
                            resource: humanResources,
                            type: 'highlight-demand',
                        });
                    }
                }

                if (!!timeslots && timeslots.length > 0) {
                    let timeslotIndex = 0;
                    for (const { start, end } of timeslots) {
                        schedule.markers.push({
                            id: `highlights/${id}/t/${timeslotIndex++}`,
                            start: start.toString({ timeZoneName: 'never' }),
                            end: end.toString({ timeZoneName: 'never' }),
                            resource: humanResources,
                            type: 'highlight-timeslot',
                        });
                    }
                }
            }
        } else {
            await writeUserSetting(
                user.id, 'user-admin-schedule-highlight-shifts', undefined);
        }

        // -----------------------------------------------------------------------------------------
        // Retrieve information about the assigned shifts.
        // -----------------------------------------------------------------------------------------

        const shifts = await getShiftsForEvent(event.id, festivalId ?? 0);
        const shiftsMap = new Map(shifts.map(shift => [ shift.id, shift ]));

        const scheduledShifts = await dbInstance.selectFrom(tSchedule)
            .where(tSchedule.eventId.equals(event.id))
                .and(tSchedule.scheduleDeleted.isNull())
                .and(tSchedule.userId.in(users))
                .and(tSchedule.scheduleTimeEnd.greaterOrEqual(min))
                .and(tSchedule.scheduleTimeStart.lessOrEqual(max))
            .select({
                id: tSchedule.scheduleId,
                start: tSchedule.scheduleTimeStart,
                end: tSchedule.scheduleTimeEnd,
                resource: tSchedule.userId,
                shiftId: tSchedule.shiftId,
            })
            .executeSelectMany();

        for (const scheduledShift of scheduledShifts) {
            const shift =
                !!scheduledShift.shiftId ? shiftsMap.get(scheduledShift.shiftId)
                                         : {
                                               name: 'Unscheduled',
                                               colour: '#760707',
                                               categoryContributionCounts: false,
                                           };

            if (!shift)
                continue;  // the |scheduledShift| is not associated with a valid shift

            schedule.shifts.push({
                id: scheduledShift.id,
                shiftId: scheduledShift.shiftId,
                start: scheduledShift.start.toString({ timeZoneName: 'never' }),
                end: scheduledShift.end.toString({ timeZoneName: 'never' }),
                title: shift.name,
                color: shift.colour,
                resource: scheduledShift.resource,
                noContribution: shift.categoryContributionCounts ? undefined : true,
            });

            // TODO: Compute warnings
        }

        // -----------------------------------------------------------------------------------------
        // Include information about the `shifts` that exist for this festival
        // -----------------------------------------------------------------------------------------

        const recentShifts = await dbInstance.selectDistinctFrom(tSchedule)
            .where(tSchedule.eventId.equals(event.id))
                .and(tSchedule.shiftId.isNotNull())
                .and(tSchedule.scheduleUpdatedBy.equals(user.id))
            .selectOneColumn(tSchedule.shiftId)
            .orderBy(tSchedule.scheduleUpdated, 'desc')
            .limit(settings['schedule-recent-shift-count'] ?? 4)
            .executeSelectMany();

        for (const shiftId of recentShifts) {
            if (shiftsMap.has(shiftId!))
                schedule.metadata.recent.push(shiftId!);
        }

        for (const shift of shifts) {
            if (!schedule.metadata.teams.hasOwnProperty(shift.team.slug)) {
                schedule.metadata.teams[shift.team.slug] = {
                    color: shift.team.color,
                    label: shift.team.name,
                };
            }

            schedule.metadata.shifts.push({
                id: shift.id,
                label: shift.name,
                color: shift.colour,
                localTeam: shift.team.id === team.id,
                status:
                    shift.scheduledInMinutes === 0
                        ? 'error'
                        : !!shift.warning ? 'warning' : 'complete',
                team: shift.team.slug,
                warning: shift.warning,
            });
        }

        schedule.metadata.shifts.sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));

        // -----------------------------------------------------------------------------------------

        return {
            success: true,
            schedule,
        };
    });
}
