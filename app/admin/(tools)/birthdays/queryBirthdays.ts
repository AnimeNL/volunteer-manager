// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AccessControl } from '@lib/auth/AccessControl';
import { Temporal } from '@lib/Temporal';
import db, { tEvents, tTeams, tUsers, tUsersEvents } from '@lib/database';

/**
 * Only consider volunteers who have helped us out in the past N years.
 */
const kParticipationCutoffYears = 3;

/**
 * Information available for each of the resulting queried birthdays.
 */
interface Birthday {
    /**
     * Unique ID of the user whose birthday it is.
     */
    id: number;

    /**
     * Full name, or display name when applicable, of this user.
     */
    name: string;

    /**
     * Date on which they celebrate their birthday.
     */
    birthday: Temporal.PlainDate;

    /**
     * Occurrence of their birthday in the current year.
     */
    occurrence: Temporal.PlainDate;
}

/**
 * Parameters that can be passed to the query function.
 */
interface BirthdayWindow {
    /**
     * Number of days in the past birthdays should be selected by.
     */
    pastDays: number;

    /**
     * Number of days in the future birthdays should be selected to.
     */
    futureDays: number;
};

/**
 * Queries birthdays from the database in accordance with the `params`. All returned birthdays will
 * be validated for visibility given the `access` for the signed in user.
 */
export async function queryBirthdays(access: AccessControl, selectionWindow?: BirthdayWindow)
    : Promise<Birthday[]>
{
    const currentDate = Temporal.Now.plainDateISO();

    const participationCutoffDate = currentDate.subtract({ years: kParticipationCutoffYears })
        .toZonedDateTime('UTC');

    let monthRange: number[] | undefined;

    let selectionStartDate: Temporal.PlainDate | undefined;
    let selectionEndDate: Temporal.PlainDate | undefined;

    if (!!selectionWindow) {
        selectionStartDate = currentDate.subtract({ days: selectionWindow.pastDays });
        selectionEndDate = currentDate.add({ days: selectionWindow.futureDays });

        // Temporal represents months in a human optimised way, i.e. January is 1, whereas MySQL's
        // date representation expects January to be zero. Generate a range.
        const zeroBasedStartMonth = selectionStartDate.month - 1;
        const zeroBasedEndMonth = selectionEndDate.month - 1;

        const monthRangeLength = ((zeroBasedEndMonth - zeroBasedStartMonth + 12) % 12) + 1;
        monthRange = Array.from({ length: monthRangeLength }, (_, index) =>
            (zeroBasedStartMonth + index) % 12);
    }

    const dbInstance = db;
    const birthdays = await dbInstance.selectFrom(tUsers)
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.userId.equals(tUsers.userId))
                .and(tUsersEvents.registrationStatus.equals('Accepted'))
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
                .and(tEvents.eventEndTime.greaterOrEqual(participationCutoffDate))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tUsers.anonymized.isNull())
            .and(tUsers.birthdate.isNotNull())
            .and(tUsers.birthdate.getMonth().inIfValue(monthRange))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            birthday: tUsers.birthdate,
            events: dbInstance.aggregateAsArray({
                event: tEvents.eventSlug,
                team: tTeams.teamSlug,
            }),
        })
        .groupBy(tUsers.userId)
        .orderBy('birthday', 'asc')
        .executeSelectMany();

    // Restrict accessible |birthdays| to the volunteers who participated in an event that the
    // signed in user had access too, maximising the chance that they have heard of each other.
    const accessibleBirthdays = birthdays.filter(({ events }) => {
        for (const { event, team } of events) {
            if (access.can('event.visible', { event, team }))
                return true;
        }

        return false;
    });

    // Define the occurrence of the birthday in the current year, considering both year transitions
    // and handling leap-year (February 29th) constraints.
    let accessibleBirthdaysWithOccurrence = accessibleBirthdays.map(birthday => {
        let occurrence = Temporal.PlainDate.from({
            year: currentDate.year,
            month: birthday.birthday!.month,
            day: birthday.birthday!.day,

        }, { overflow: 'constrain' });

        const daysDifference = currentDate.until(occurrence).days;
        if (daysDifference < -180)
            occurrence = occurrence.add({ years: 1 });
        else if (daysDifference > 180)
            occurrence = occurrence.subtract({ years: 1 });

        return {
            id: birthday.id,
            name: birthday.name,
            birthday: birthday.birthday!,
            occurrence
        };
    });

    accessibleBirthdaysWithOccurrence.sort((lhs, rhs) =>
        Temporal.PlainDate.compare(lhs.occurrence, rhs.occurrence));

    // Select the birthdays whose occurrence this year falls within the visibility window.
    if (!!selectionStartDate && !!selectionEndDate) {
        accessibleBirthdaysWithOccurrence =
            accessibleBirthdaysWithOccurrence.filter(({ occurrence }) => {
                return Temporal.PlainDate.compare(occurrence, selectionStartDate) >= 0 &&
                       Temporal.PlainDate.compare(occurrence, selectionEndDate) <= 0;
            });
    }

    return accessibleBirthdaysWithOccurrence;
}
