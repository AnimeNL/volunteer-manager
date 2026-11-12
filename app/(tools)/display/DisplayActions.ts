// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { cookies } from 'next/headers';
import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import type { DisplayHelpRequestStatus } from '@lib/database/Types';
import { Publish } from '@lib/subscriptions';
import { executeServerAction } from '@lib/serverAction';
import { getDisplayIdFromCookieStore, writeDisplayIdToCookieStore } from '@lib/auth/DisplaySession';
import { isBefore } from '@lib/Temporal';
import { readSettings } from '@lib/Settings';
import db, { tActivities, tActivitiesLocations, tActivitiesTimeslots, tDisplays, tDisplaysRequests,
    tEvents, tNardo, tRoles, tSchedule, tShifts, tStorage, tTeams, tUsers, tUsersEvents }
    from '@lib/database';

import { kDisplayHelpRequestStatus, kDisplayHelpRequestTarget, kRegistrationStatus,
    kSubscriptionType } from '@lib/database/Types';
import { kTargetToTypeId } from '@lib/subscriptions/drivers/HelpDriver';

/**
 * Interface defining an individual shift that will be shared with the display.
 */
export interface DisplayShiftInfo {
    /**
     * Unique ID of this schedule entry. Should be used for keying.
     */
    id: number;

    /**
     * Time at which this shift will start, as a UNIX timestamp in UTC.
     */
    start: number;

    /**
     * Time at which this shift will end, as a UNIX timestamp in UTC.
     */
    end: number;

    /**
     * Name of the volunteer who will work on this shift.
     */
    name: string;

    /**
     * Optional URL to the volunteer's avatar, when available.
     */
    avatar?: string;

    /**
     * Team that the volunteer is part of.
     */
    team: string;

    /**
     * Role that this volunteer has within the AnimeCon organisation.
     */
    role: string;
}

/**
 * Interface defining the configuration and schedule context shared with a display.
 */
export interface DisplayConfiguration {
    /**
     * Identifier of the display, through which it can be visually identified.
     */
    identifier: string;

    /**
     * Label that should be shown on the display. Expected to make sense to humans.
     */
    label: string;

    /**
     * Whether the device has been fully provisioned and is ready for use.
     */
    provisioned: boolean;

    /**
     * Configuration that influences the frontend's configuration.
     */
    config: {
        /**
         * Whether volume changes should be audibly confirmed.
         */
        confirmVolumeChanges: boolean;

        /**
         * Optional link to the development environment.
         */
        devEnvironment?: string;

        /**
         * Whether advice can be requested as one of the types in the "request help" feature.
         */
        enableRequestAdvice: boolean;

        /**
         * Whether the "request help" feature should be enabled on the display.
         */
        enableRequestHelp: boolean;

        /**
         * Time offset, in seconds, to alter the local timestamp by. Used to emulate the schedule at
         * another point in time for testing purposes.
         */
        timeOffset?: number;

        /**
         * Timezone in which the display operates. Will affect the local time.
         */
        timezone: string;

        /**
         * How frequently should the display check in? Indicated in milliseconds.
         */
        updateFrequencyMs: number;
    };

    /**
     * Information and settings regarding the display's device.
     */
    device: {
        /**
         * Optional color that the device's light strip should be set to.
         */
        color?: string;

        /**
         * Whether the device should be locked.
         */
        locked: boolean;
    };

    /**
     * Information about the event for which the display has been provisioned, if any.
     */
    event?: {
        /**
         * Date and time at which the event will start, in Temporal ZDT-compatible format.
         */
        start: string;

        /**
         * Date and time at which the event will end, in Temporal ZDT-compatible format.
         */
        end: string;
    };

    /**
     * Status of the help request that has been issued by this display, if any.
     */
    helpRequestStatus?: DisplayHelpRequestStatus;

    /**
     * The piece of Del a Rie advice that should be shared.
     */
    nardo?: string;

    /**
     * The schedule that will be taking place in this location. We share all shifts with the
     * device, which will present them in a way that's meaningful for the present situation.
     */
    schedule: {
        past: DisplayShiftInfo[];
        active: DisplayShiftInfo[];
        future: DisplayShiftInfo[];
    };
}

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
 * Zod type that describes the data required when retrieving a display's context.
 */
const kGetDisplayContextData = z.object({ /* no input is required */ });

/**
 * Server Action through which displays retrieve their context. Each display will be uniquely
 * identified with an autogenerated code, after which it has to be provisioned in our administration
 * area.
 */
export async function getDisplayContext() {
    return executeServerAction({}, kGetDisplayContextData, async (_data, props) => {
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
            seconds: settings['display-time-offset-seconds'] ?? 0,
        });

        const cookieStore = await cookies();
        const dbInstance = db;

        // -----------------------------------------------------------------------------------------
        // Step 1: Ensure that the device that's checking in is represented in our system
        // -----------------------------------------------------------------------------------------

        let displayId = await getDisplayIdFromCookieStore(cookieStore);
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

            await writeDisplayIdToCookieStore(cookieStore, displayId);
        }

        // -----------------------------------------------------------------------------------------
        // Step 2: Read static information that should be shown on the display
        // -----------------------------------------------------------------------------------------

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

        // -----------------------------------------------------------------------------------------

        const updateFrequencySeconds =
            !!configuration.helpRequestStatus
                ? settings['display-check-in-rate-help-requested-seconds']
                : settings['display-check-in-rate-seconds'];

        const updateFrequencyMs = clampUpdateFrequencyMs(/* seconds= */ updateFrequencySeconds);

        // The `updateFrequencyMs` will be calculated based on the shifts, when a change occurs
        // we'll pull forward the upcoming update to give the display a visually faster response
        // time.
        let nextUpdate = currentTime.add({ milliseconds: updateFrequencyMs });

        // Determine the device's colour, which depends first on whether a help request is in
        // progress, and second on whether the device has a hardcoded colour.
        let color: string | undefined = configuration.color;
        switch (configuration.helpRequestStatus) {
            case kDisplayHelpRequestStatus.Pending:
                color = '#ff0000';  // red
                break;

            case kDisplayHelpRequestStatus.Acknowledged:
                color = '#ff6000';  // orange
                break;
        }

        const context: DisplayConfiguration = {
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
            context.event = {
                start: configuration.eventStart,
                end: configuration.eventEnd,
            };
        }

        // -----------------------------------------------------------------------------------------
        // Step 2: Read static information that should be shown on the display
        // -----------------------------------------------------------------------------------------

        if (!!settings['schedule-del-a-rie-advies']) {
            const timeLimitMinutes = settings['schedule-del-a-rie-advies-time-limit'] ?? 5;
            const timeLimitSeconds = timeLimitMinutes * 60;

            const seedBase = Math.round(Temporal.Now.instant().epochMilliseconds / 1000);
            const seed = Math.round(seedBase / timeLimitSeconds) * timeLimitSeconds;

            context.nardo = await dbInstance.selectFrom(tNardo)
                .where(tNardo.nardoVisible.equals(/* true= */ 1))
                .selectOneColumn(tNardo.nardoAdvice)
                .orderBy(dbInstance.rawFragment`rand(${dbInstance.const(seed, 'int')})`)
                .limit(1)
                .executeSelectNoneOrOne() ?? undefined;
        }

        // -----------------------------------------------------------------------------------------
        // Step 3: Read the shifts that should be presented on the display
        // -----------------------------------------------------------------------------------------

        if (!!context.provisioned && !!configuration.eventId && !!configuration.locationId) {
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
                            .and(tUsersEvents.registrationStatus.equals(
                                kRegistrationStatus.Accepted))
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
                    const completedEntry: DisplayShiftInfo = {
                        ...entry,
                        start: Math.round(entry.start.epochMilliseconds / 1000),
                        end: Math.round(entry.end.epochMilliseconds / 1000),
                        avatar: entry.avatar ? `/blob/${entry.avatar}.png` : undefined,
                    };

                    if (isBefore(entry.end, currentTime)) {
                        context.schedule.past.push(completedEntry);
                    } else if (isBefore(entry.start, currentTime)) {
                        context.schedule.active.push(completedEntry);
                        if (isBefore(entry.end, nextUpdate))
                            nextUpdate = entry.end;
                    } else {
                        context.schedule.future.push(completedEntry);
                        if (isBefore(entry.start, nextUpdate))
                            nextUpdate = entry.start;
                    }
                }
            }
        }

        // Update the display's light colour to green when there are active shifts, and no other
        // colour has been assigned to the display already. This reflects the fact that the area is
        // active.
        if (!context.device.color && context.schedule.active.length > 0)
            context.device.color = '#00ff00';  // green

        // Decrease the update frequency in case `nextUpdate` is lower than the configured update
        // frequency, which contributes to a visually faster response time of the displays.
        {
            const nextUpdateSeconds = currentTime.until(nextUpdate, { largestUnit: 'seconds' });
            context.config.updateFrequencyMs =
                clampUpdateFrequencyMs(/* seconds= */ nextUpdateSeconds.seconds);
        }

        return {
            success: true,
            context,
        };

    }, /* allowVisitors= */ true);
}

/**
 * Maps a given `DisplayHelpRequestTarget` target to a textual subject to use in a message. Use
 * generally looks like: "...requested help with [value]".
 */
const kTargetToSubject: { [k in keyof typeof kDisplayHelpRequestTarget]: string } = {
    [kDisplayHelpRequestTarget.Crew]: 'a volunteering matter',
    [kDisplayHelpRequestTarget.Nardo]: 'a Del a Rie advice query',
    [kDisplayHelpRequestTarget.Stewards]: 'a steward-related matter',
};

/**
 * Zod type that describes the data required when requesting help from a display.
 */
const kRequestHelpData = z.object({
    /**
     * To whom should the help request be directed?
     */
    target: z.enum(kDisplayHelpRequestTarget),
});

/**
 * Server Action through which displays can request help. The identified display must be a
 * provisioned display associated with a particular event. The request will be published to
 * subscribed volunteers.
 */
export async function requestHelp(formData: unknown) {
    return executeServerAction(formData, kRequestHelpData, async (data, props) => {
        if (!props.ip)
            forbidden();

        const displayId = await getDisplayIdFromCookieStore(await cookies());
        if (!displayId)
            forbidden();

        const dbInstance = db;
        const configuration = await dbInstance.selectFrom(tDisplays)
            .innerJoin(tActivitiesLocations)
                .on(tActivitiesLocations.locationId.equals(tDisplays.displayLocationId))
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tDisplays.displayEventId))
            .where(tDisplays.displayId.equals(displayId))
                .and(tDisplays.displayDeleted.isNull())
            .select({
                eventId: tEvents.eventId,
                label: tDisplays.displayLabel,
                location: tActivitiesLocations.locationDisplayName.valueWhenNull(
                    tActivitiesLocations.locationName),
            })
            .executeSelectNoneOrOne();

        if (!configuration)
            return { success: false, error: 'The display has not been provisioned yet' };

        const settings = await readSettings([
            'display-request-advice',
            'display-request-help',
        ]);

        if (!settings['display-request-help'])
            return { success: false, error: 'The "help request" feature is not available' };

        if (!settings['display-request-advice'] &&
                data.target === kDisplayHelpRequestTarget.Nardo) {
            return {
                success: false,
                error: 'Del a Rie Advies is currently not available for advice',
            };
        }

        if (!Object.hasOwn(kTargetToTypeId, data.target))
            return { success: false, error: 'Cannot determine what type of help is required' };

        const insertId = await dbInstance.transaction(async () => {
            const insertId = await dbInstance.insertInto(tDisplaysRequests)
                .set({
                    displayId,
                    requestEventId: configuration.eventId,
                    requestReceivedDate: dbInstance.currentZonedDateTime(),
                    requestReceivedTarget: data.target,
                })
                .returningLastInsertedId()
                .executeInsert();

            await dbInstance.update(tDisplays)
                .set({
                    displayHelpRequestStatus: kDisplayHelpRequestStatus.Pending,
                })
                .where(tDisplays.displayId.equals(displayId))
                .executeUpdate();

            return insertId;
        });

        if (!insertId)
            return { success: false, error: 'Unable to store the help request in the database' };

        await Publish({
            type: kSubscriptionType.Help,
            typeId: kTargetToTypeId[data.target],
            message: {
                requestId: insertId,
                location: configuration.label || configuration.location,
                subject: kTargetToSubject[data.target],
            },
        });

        return { success: true };

    }, /* allowVisitors= */ true);
}
