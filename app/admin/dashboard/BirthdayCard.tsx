// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Button from '@mui/material/Button';
import CakeIcon from '@mui/icons-material/Cake';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AccessControl } from '@lib/auth/AccessControl';
import { DashboardCard } from './DashboardCard';
import { DashboardCardHeader } from './DashboardCardHeader';
import { Temporal, formatDate, formatDuration } from '@lib/Temporal';
import db, { tEvents, tTeams, tUsers, tUsersEvents } from '@lib/database';

/**
 * Only consider volunteers who have helped us out in the past N years.
 */
const kParticipationCutoffYears = 3;

/**
 * Number of days in the future for which birthdays should be considered. Further filtering may
 * apply based on access checks and visibility limits.
 */
const kSelectionFutureDays = 60;

/**
 * Number of days in the past for which birthdays should be considered. Further filtering may apply
 * based on access checks and visibility limits.
 */
const kSelectionPastDays = 4;

/**
 * Number of past birthdays that should be presented.
 */
const kVisiblePastBirthdays = 3;

/**
 * Number of future birthdays that should be presented.
*/
const kVisibileFutureBirthdays = 5;

/**
 * Props accepted by the <BirthdayCard> component.
 */
interface BirthdayCardProps {
    /**
     * Access control manager through which visibility can be determined.
     */
    access: AccessControl;
}

/**
 * The <BirthdayCard> displays the recent and upcoming birthdays of volunteers. The specific list of
 * volunteers will be filtered depending on the signed in user's access.
 */
export async function BirthdayCard(props: BirthdayCardProps) {
    const currentDate = Temporal.Now.plainDateISO();

    const selectionStartDate = currentDate.subtract({ days: kSelectionPastDays });
    const selectionEndDate = currentDate.add({ days: kSelectionFutureDays });

    const participationCutoffDate = currentDate.subtract({ years: kParticipationCutoffYears })
        .toZonedDateTime('UTC');

    // Temporal represents months in a human optimised way, i.e. January is 1, whereas MySQL's date
    // representation expects January to be zero. Generate a range.
    const zeroBasedStartMonth = selectionStartDate.month - 1;
    const zeroBasedEndMonth = selectionEndDate.month - 1;

    const monthRangeLength = ((zeroBasedEndMonth - zeroBasedStartMonth + 12) % 12) + 1;
    const monthRange = Array.from({ length: monthRangeLength }, (_, index) =>
        (zeroBasedStartMonth + index) % 12);

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
            .and(tUsers.birthdate.getMonth().in(monthRange))
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
            if (props.access.can('event.visible', { event, team }))
                return true;
        }

        return false;
    });

    // Define the occurrence of the birthday in the current year, considering both year transitions
    // and handling leap-year (February 29th) constraints.
    const accessibleBirthdaysWithOccurrence = accessibleBirthdays.map(birthday => {
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

        return { ...birthday, occurrence };
    });

    accessibleBirthdaysWithOccurrence.sort((lhs, rhs) =>
        Temporal.PlainDate.compare(lhs.occurrence, rhs.occurrence));

    // Select the birthdays whose occurrence this year falls within the visibility window.
    const birthdaysInWindow = accessibleBirthdaysWithOccurrence.filter(({ occurrence }) => {
        return Temporal.PlainDate.compare(occurrence, selectionStartDate) >= 0 &&
               Temporal.PlainDate.compare(occurrence, selectionEndDate) <= 0;
    });

    // Group the birthdays within three buckets: ones that happened in the past, birthdays that are
    // happening right this very day, and ones that are happening in the (near) future.
    const pastBirthdays: BirthdayListItemProps['birthday'][] = [];
    const currentBirthdays: BirthdayListItemProps['birthday'][] = [];
    const futureBirthdays: BirthdayListItemProps['birthday'][] = [];

    for (const item of birthdaysInWindow) {
        const comparison = Temporal.PlainDate.compare(item.occurrence, currentDate);
        if (comparison < 0)
            pastBirthdays.push(item);
        else if (comparison === 0)
            currentBirthdays.push(item);
        else
            futureBirthdays.push(item);
    }

    // And finally compose the list of visible birthdays, each limited to the maximum number of them
    // that we want to present on the dashboard. A fully fledged calendar will be made available.
    const visibleBirthdays = [
        ...pastBirthdays.slice(-kVisiblePastBirthdays),
        ...currentBirthdays,
        ...futureBirthdays.slice(0, kVisibileFutureBirthdays),
    ];

    return (
        <DashboardCard>
            <DashboardCardHeader src="/images/admin/birthday-header.jpg?v2"
                                 title="Database" secondary />
            <Stack sx={{ px: 2, pb: 1 }}>
                <Typography variant="h6" sx={{ mt: 1 }}>
                    Upcoming birthdays
                </Typography>
                <List dense>
                    { visibleBirthdays.map(birthday =>
                        <BirthdayListItem key={birthday.id} birthday={birthday}
                                          today={currentDate} /> ) }
                </List>
                <Button variant="outlined" sx={{ mb: 1 }} startIcon={ <CalendarMonthIcon /> }
                        LinkComponent={Link} href="/admin/birthdays">
                    Birthday calendar
                </Button>
            </Stack>
        </DashboardCard>
    );
}

/**
 * Props accepted by the <BirthdayListItem> component.
 */
interface BirthdayListItemProps {
    /**
     * Details about the birthday that this component should display.
     */
    birthday: {
        /**
         * Unique ID of the user whose birthday it is.
         */
        id: number;

        /**
         * Name of the volunteer who is celebrating their birthday.
         */
        name: string;

        /**
         * Date on which they will be celebrating their birthday this year.
         */
        occurrence: Temporal.PlainDate;
    };

    /**
     * Present date.
     */
    today: Temporal.PlainDate;
}

/**
 * The <BirthdayListItem> component shows an individual birthday row. Different styling and content
 * is applied based on when exactly the birthday will be happening.
 */
function BirthdayListItem(props: BirthdayListItemProps) {
    const relationToToday = Temporal.PlainDate.compare(props.today, props.birthday.occurrence);
    const color =
        relationToToday < 0 ? 'disabled'
             : relationToToday === 0  ? 'primary'
             : 'error';

    return (
        <ListItem disableGutters>
            <ListItemIcon>
                <CakeIcon color={color} fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={props.birthday.name}
                          slotProps={{ primary: { noWrap: true } }} />
            { relationToToday !== 0 &&
                <Typography variant="body2" color="textSecondary" noWrap sx={{ ml: 2 }}>
                    { relationToToday < 0 && formatDate(props.birthday.occurrence, 'MMM D') }
                    { relationToToday > 0 &&
                        formatDuration(props.birthday.occurrence.since(props.today)) }
                </Typography> }
            { relationToToday === 0 &&
                <Typography variant="body2" color="primary" sx={{ ml: 2, fontWeight: 'bold' }}>
                    Today!
                </Typography> }
        </ListItem>
    );
}
