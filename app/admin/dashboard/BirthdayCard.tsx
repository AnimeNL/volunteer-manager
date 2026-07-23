// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Alert from '@mui/material/Alert';
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
import { InlineAccountLink } from '../components/InlineAccountLink';
import { formatDate, formatDuration } from '@lib/Temporal';
import { queryBirthdays } from '../(tools)/birthdays/queryBirthdays';

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
 * The <BirthdayCard> displays the recent and upcoming birthdays of volunteers. The specific list of
 * volunteers will be filtered depending on the signed in user's access.
 */
export async function BirthdayCard(props: { access: AccessControl }) {
    const currentDate = Temporal.Now.plainDateISO();

    const birthdays = await queryBirthdays(props.access, {
        pastDays: kSelectionPastDays,
        futureDays: kSelectionFutureDays,
    });

    // Group the birthdays within three buckets: ones that happened in the past, birthdays that are
    // happening right this very day, and ones that are happening in the (near) future.
    const pastBirthdays: BirthdayListItemProps['birthday'][] = [];
    const currentBirthdays: BirthdayListItemProps['birthday'][] = [];
    const futureBirthdays: BirthdayListItemProps['birthday'][] = [];

    for (const item of birthdays) {
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
                { !visibleBirthdays.length &&
                    <Alert variant="outlined" severity="info" sx={{ mt: 1, mb: 2 }}>
                        No upcoming birthdays on the horizon!
                    </Alert> }
                { !!visibleBirthdays.length &&
                    <List dense>
                        { visibleBirthdays.map(birthday =>
                            <BirthdayListItem key={birthday.id} birthday={birthday}
                                              today={currentDate} /> ) }
                    </List> }
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

    const user = {
        id: props.birthday.id,
        name: props.birthday.name,
    };

    return (
        <ListItem disableGutters>
            <ListItemIcon>
                <CakeIcon color={color} fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={ <InlineAccountLink user={user} /> }
                          slotProps={{
                              primary: {
                                  noWrap: true,
                                  sx: { '& > a': { color: 'text.primary', textDecoration: 'none' } }
                              }
                          }} />
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
