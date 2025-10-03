// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { Temporal, isBefore } from '@lib/Temporal';
import { executeAction, type ActionProps } from '../Action';
import { getDisplayIdFromHeaders, writeDisplayIdToHeaders } from '@lib/auth/DisplaySession';
import { readSettings } from '@lib/Settings';
import db, { tActivities, tActivitiesLocations, tActivitiesTimeslots, tDisplays, tEvents, tNardo,
    tRoles, tSchedule, tShifts, tStorage, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kDisplayHelpRequestStatus, kRegistrationStatus } from '@lib/database/Types';

/**
 * Interface defining an individual shift that will be shared with the display.
 */
const kDisplayShiftDefinition = z.object({
    /**
     * Unique ID of this schedule entry. Should be used for keying.
     */
    id: z.number(),

    /**
     * Time at which this shift will start, as a UNIX timestamp in UTC.
     */
    start: z.number(),

    /**
     * Time at which this shift will end, as a UNIX timestamp in UTC.
     */
    end: z.number(),

    /**
     * Name of the volunteer who will work on this shift.
     */
    name: z.string(),

    /**
     * Optional URL to the volunteer's avatar, when available.
     */
    avatar: z.string().optional(),

    /**
     * Team that the volunteer is part of.
     */
    team: z.string(),

    /**
     * Role that this volunteer has within the AnimeCon organisation.
     */
    role: z.string(),
});

/**
 * Interface definition for the Display API, exposed through /api/display.
 */
const kDisplayDefinition = z.object({
    request: z.object({ /* no input is required */ }),
    response: z.object({
        /**
         * Identifier of the display, through which it can be visually identified.
         */
        identifier: z.string(),

        /**
         * Label that should be shown on the display. Expected to make sense to humans.
         */
        label: z.string(),

        /**
         * Whether the device has been fully provisioned and is ready for use.
         */
        provisioned: z.boolean(),

        /**
         * Configuration that influence the frontend's configuration.
         */
        config: z.object({
            /**
             * Whether volume changes should be audibly confirmed.
             */
            confirmVolumeChanges: z.boolean(),

            /**
             * Optional link to the development environment.
             */
            devEnvironment: z.string().optional(),

            /**
             * Whether advice can be requested as one of the types in the "request help" feature.
             */
            enableRequestAdvice: z.boolean(),

            /**
             * Whether the "request help" feature should be enabled on the display.
             */
            enableRequestHelp: z.boolean(),

            /**
             * Time offset, in seconds, to alter the local timestamp by. Used to emulate the
             * schedule at another point in time for testing purposes.
             */
            timeOffset: z.number().optional(),

            /**
             * Timezone in which the display operates. Will affect the local time.
             */
            timezone: z.string(),

            /**
             * How frequently should the display check in? Indicated in milliseconds.
             */
            updateFrequencyMs: z.number(),
        }),

        /**
         * Information and settings regarding the display's device.
         */
        device: z.object({
            /**
             * Optional color that the device's light strip should be set to.
             */
            color: z.string().optional(),

            /**
             * Whether the device should be locked.
             */
            locked: z.boolean(),
        }),

        /**
         * Information about the event for which the display has been provisioned, if any.
         */
        event: z.object({
            /**
             * Date and time at which the event will start, in Temporal ZDT-compatible format.
             */
            start: z.string(),

            /**
             * Date and time at which the event will end, in Temporal ZDT-compatible format.
             */
            end: z.string(),

        }).optional(),

        /**
         * Status of the help request that has been issued by this display, if any.
         */
        helpRequestStatus: z.enum(kDisplayHelpRequestStatus).optional(),

        /**
         * The piece of Del a Rie advice that should be shared.
         */
        nardo: z.string().optional(),

        /**
         * The schedule that will be taking place in this location. We share all shifts with the
         * device, which will present them in a way that's meaningful for the present situation.
         */
        schedule: z.object({
            past: z.array(kDisplayShiftDefinition),
            active: z.array(kDisplayShiftDefinition),
            future: z.array(kDisplayShiftDefinition),
        }),
    }),
});

export type DisplayDefinition = ApiDefinition<typeof kDisplayDefinition>;
export type DisplayShiftDefinition = z.infer<typeof kDisplayShiftDefinition>;

type Request = ApiRequest<typeof kDisplayDefinition>;
type Response = ApiResponse<typeof kDisplayDefinition>;

/**
 * Clamps the update frequency, given in the number of `seconds`, to [5, 600), and returns the
 * result as a number of milliseconds.
 */
function clampUpdateFrequencyMs(seconds?: number): number {
    return Math.min(Math.max(5, seconds ?? 300), 600) * 1000;
}

/**
 * Generates an identifier for the display based on a limited alphabet, optimised for clear reading.
 */
function generateDisplayIdentifier(length: number): string {
    const kIdentifierAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';  // no "I" or "O"

    let identifier = '';
    for (let character = 0; character < length; ++character) {
        identifier += kIdentifierAlphabet.charAt(
            Math.floor(Math.random() * kIdentifierAlphabet.length));
    }

    return identifier;
}

/**
 * API through which displays retrieve their context. Each display will be uniquely identified with
 * an autogenerated code, after which it has to be provisioned in our administration area.
 */
async function display(request: Request, props: ActionProps): Promise<Response> {
    if (!props.ip)
        forbidden();

    const settings = await readSettings([
        'display-check-in-rate-help-requested-seconds',
        'display-check-in-rate-seconds',
        'display-confirm-volume-change',
        'display-dev-environment-link',
        'display-request-advice',
        'display-request-help',
        'display-time-offset-seconds',
        'schedule-del-a-rie-advies',
        'schedule-del-a-rie-advies-time-limit',
    ]);

    const currentServerTime = Temporal.Now.zonedDateTimeISO('UTC');
    const currentTime = currentServerTime.add({
        seconds: settings['display-time-offset-seconds'] ?? 0
    });

    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Step 1: Ensure that the device that's checking in is represented in our system
    // ---------------------------------------------------------------------------------------------

    let displayId: number | undefined = await getDisplayIdFromHeaders(props.requestHeaders);
    if (!!displayId) {
        const affectedRows = await dbInstance.update(tDisplays)
            .set({
                displayCheckIn: dbInstance.currentZonedDateTime(),
                displayCheckInIp: props.ip,
            })
            .where(tDisplays.displayId.equals(displayId))
                .and(tDisplays.displayDeleted.isNull())
            .executeUpdate();

        if (!affectedRows)
            displayId = /* reset= */ undefined;
    }

    if (!displayId) {
        displayId = await dbInstance.insertInto(tDisplays)
            .set({
                displayIdentifier: generateDisplayIdentifier(/* length= */ 4),
                displayCheckIn: dbInstance.currentZonedDateTime(),
                displayCheckInIp: props.ip,
                displayLocked: /* true= */ 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        await writeDisplayIdToHeaders(props.responseHeaders, displayId);
    }

    // ---------------------------------------------------------------------------------------------
    // Step 2: Read static information that should be shown on the display
    // ---------------------------------------------------------------------------------------------

    const activitiesLocationsJoin = tActivitiesLocations.forUseInLeftJoin();
    const eventsJoin = tEvents.forUseInLeftJoin();

    const configuration = await dbInstance.selectFrom(tDisplays)
        .leftJoin(activitiesLocationsJoin)
            .on(activitiesLocationsJoin.locationId.equals(tDisplays.displayLocationId))
        .leftJoin(eventsJoin)
            .on(eventsJoin.eventId.equals(tDisplays.displayEventId))
        .where(tDisplays.displayId.equals(displayId))
        .select({
            identifier: tDisplays.displayIdentifier,
            color: tDisplays.displayColor,
            label: tDisplays.displayLabel,
            locked: tDisplays.displayLocked.equals(/* true= */ 1),
            helpRequestStatus: tDisplays.displayHelpRequestStatus,
            timezone: eventsJoin.eventTimezone,

            // Event information:
            eventId: eventsJoin.eventId,
            eventStart: dbInstance.dateTimeAsString(eventsJoin.eventStartTime),
            eventEnd: dbInstance.dateTimeAsString(eventsJoin.eventEndTime),

            // Location information:
            locationId: activitiesLocationsJoin.locationId,
        })
        .executeSelectOne();

    // ---------------------------------------------------------------------------------------------

    const updateFrequencySeconds =
        !!configuration.helpRequestStatus ? settings['display-check-in-rate-help-requested-seconds']
                                          : settings['display-check-in-rate-seconds'];

    const updateFrequencyMs = clampUpdateFrequencyMs(/* seconds= */ updateFrequencySeconds);

    // The `updateFrequencyMs` will be calculated based on the shifts, when a change occurs we'll
    // pull forward the upcoming update to give the display a visually faster response time.
    let nextUpdate = currentTime.add({ milliseconds: updateFrequencyMs });

    // Determine the device's colour, which depends first on whether a help request is in progress,
    // and second on whether the device has a hardcoded colour.
    let color: string | undefined = configuration.color;
    switch (configuration.helpRequestStatus) {
        case kDisplayHelpRequestStatus.Pending:
            color = '#ff0000';  // red
            break;

        case kDisplayHelpRequestStatus.Acknowledged:
            color = '#ff6000';  // orange
            break;
    }

    const response: Response = {
        identifier: configuration.identifier,
        label: configuration.label ?? 'AnimeCon Display',
        provisioned: !!configuration.eventId && !!configuration.locationId,
        config: {
            confirmVolumeChanges: !!settings['display-confirm-volume-change'],
            devEnvironment: settings['display-dev-environment-link'],
            enableRequestAdvice: !!settings['display-request-advice'],
            enableRequestHelp: !!settings['display-request-help'],
            timeOffset: settings['display-time-offset-seconds'] || undefined,
            timezone: configuration.timezone ?? 'UTC',
            updateFrequencyMs,
        },
        device: {
            color,
            locked: configuration.locked,
        },
        helpRequestStatus: configuration.helpRequestStatus,
        schedule: {
            past: [ /* empty */ ],
            active: [ /* empty */ ],
            future: [ /* empty */ ],
        },
    };

    if (!!configuration.eventStart && !!configuration.eventEnd) {
        response.event = {
            start: configuration.eventStart,
            end: configuration.eventEnd,
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Step 2: Read static information that should be shown on the display
    // ---------------------------------------------------------------------------------------------

    if (!!settings['schedule-del-a-rie-advies']) {
        const timeLimitMinutes = settings['schedule-del-a-rie-advies-time-limit'] ?? 5;
        const timeLimitSeconds = timeLimitMinutes * 60;

        const seedBase = Math.round(Temporal.Now.instant().epochMilliseconds / 1000);
        const seed = Math.round(seedBase / timeLimitSeconds) * timeLimitSeconds;

        response.nardo = await db.selectFrom(tNardo)
            .where(tNardo.nardoVisible.equals(/* true= */ 1))
            .selectOneColumn(tNardo.nardoAdvice)
            .orderBy(dbInstance.rawFragment`rand(${dbInstance.const(seed, 'int')})`)
            .limit(1)
            .executeSelectNoneOrOne() ?? undefined;
    }

    // ---------------------------------------------------------------------------------------------
    // Step 3: Read the shifts that should be presented on the display
    // ---------------------------------------------------------------------------------------------

    if (!!response.provisioned && !!configuration.eventId && !!configuration.locationId) {
        const activitiesJoin = tActivities.forUseInLeftJoin();
        const activitiesTimeslotsJoin = tActivitiesTimeslots.forUseInLeftJoin();

        const shifts = await dbInstance.selectDistinctFrom(tShifts)
            .leftJoin(activitiesJoin)
                .on(activitiesJoin.activityId.equals(tShifts.shiftActivityId))
            .leftJoin(activitiesTimeslotsJoin)
                .on(activitiesTimeslotsJoin.activityId.equals(tShifts.shiftActivityId))
            .where(tShifts.eventId.equals(configuration.eventId))
                .and(tShifts.shiftDeleted.isNull())
                .and(tShifts.shiftLocationId.equals(configuration.locationId)
                    .or(activitiesJoin.activityLocationId.equals(configuration.locationId)
                    .or(activitiesTimeslotsJoin.timeslotLocationId.equals(
                        configuration.locationId))))
            .selectOneColumn(tShifts.shiftId)
            .executeSelectMany();

        if (shifts.length > 0) {
            const storageJoin = tStorage.forUseInLeftJoin();

            const schedule = await dbInstance.selectFrom(tSchedule)
                .innerJoin(tUsersEvents)
                    .on(tUsersEvents.userId.equals(tSchedule.userId))
                        .and(tUsersEvents.eventId.equals(tSchedule.eventId))
                        .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
                .innerJoin(tTeams)
                    .on(tTeams.teamId.equals(tUsersEvents.teamId))
                .innerJoin(tRoles)
                    .on(tRoles.roleId.equals(tUsersEvents.roleId))
                .innerJoin(tUsers)
                    .on(tUsers.userId.equals(tSchedule.userId))
                .leftJoin(storageJoin)
                    .on(storageJoin.fileId.equals(tUsers.avatarId))
                .where(tSchedule.shiftId.in(shifts))
                    .and(tSchedule.eventId.equals(configuration.eventId))
                    .and(tSchedule.scheduleDeleted.isNull())
                .select({
                    id: tSchedule.scheduleId,

                    start: tSchedule.scheduleTimeStart,
                    end: tSchedule.scheduleTimeEnd,

                    name: tUsers.displayName.valueWhenNull(tUsers.firstName),
                    avatar: storageJoin.fileHash,
                    team: tTeams.teamTitle,
                    role: tRoles.roleName,
                })
                .orderBy(tSchedule.scheduleTimeStart, 'asc')
                    .orderBy('name', 'asc')
                .executeSelectMany();

            for (const entry of schedule) {
                const completedEntry = {
                    ...entry,
                    start: Math.round(entry.start.epochMilliseconds / 1000),
                    end: Math.round(entry.end.epochMilliseconds / 1000),
                    avatar: entry.avatar ? `/blob/${entry.avatar}.png` : undefined,
                };

                if (isBefore(entry.end, currentTime)) {
                    response.schedule.past.push(completedEntry);
                } else if (isBefore(entry.start, currentTime)) {
                    response.schedule.active.push(completedEntry);
                    if (isBefore(entry.end, nextUpdate))
                        nextUpdate = entry.end;
                } else {
                    response.schedule.future.push(completedEntry);
                    if (isBefore(entry.start, nextUpdate))
                        nextUpdate = entry.start;
                }
            }
        }
    }

    // Update the display's light colour to green when there are active shifts, and no other colour
    // has been assigned to the display already. This reflects the fact that the area is active.
    if (!response.device.color && response.schedule.active.length > 0)
        response.device.color = '#00ff00';  // green

    // Decrease the update frequency in case `nextUpdate` is lower than the configured update
    // frequency, which contributes to a visually faster response time of the displays.
    {
        const nextUpdateSeconds = currentTime.until(nextUpdate, { largestUnit: 'seconds' });
        response.config.updateFrequencyMs =
            clampUpdateFrequencyMs(/* seconds= */ nextUpdateSeconds.seconds);
    }

    return response;
}

// The /api/display route only provides a single API - call it straight away.
export const GET = (request: NextRequest) => executeAction(request, kDisplayDefinition, display);

export const dynamic = 'force-dynamic';
