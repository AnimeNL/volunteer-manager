// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import React, { useContext, useMemo } from 'react';
import { redirect } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';

import { ErrorCard } from '../../components/ErrorCard';
import { HeaderSectionCard } from '../../components/HeaderSectionCard';
import { InlineFavouriteStar } from '../../components/InlineFavouriteStar';
import { ListItemDetails } from '../../components/ListItemDetails';
import { ListItemEventText } from '../../components/ListItemEventText';
import { ScheduleContext } from '../../ScheduleContext';
import { SetTitle } from '../../components/SetTitle';
import { SubHeader } from '../../components/SubHeader';
import { currentTimestamp, toZonedDateTime } from '../../CurrentTime';
import { formatDate } from '@lib/Temporal';

import { kLogicalDayChangeHour } from '../../lib/isDifferentDay';

/**
 * Information associated with a particular section of timeslots, generally days.
 */
interface TimeslotSectionInfo {
    /**
     * Label to assign to the section of timeslots.
     */
    label: string;

    /**
     * Whether a divider should be shown ahead of this section.
     */
    divider: boolean;

    /**
     * Whether the day has finished already. Only included to enable sorting the results.
     */
    finished: boolean;

    /**
     * The timeslots that are part of this section.
     */
    timeslots: {
        /**
         * Unique ID of this timeslot.
         */
        id: string;

        /**
         * Unique ID of the activity associated with this timeslot.
         */
        activityId: string;

        /**
         * Name of the activity that will be taking place during this timeslot.
         */
        activity: string;

        /**
         * Time at which the timeslot will start.
         */
        start: string;

        /**
         * Time at which the timeslot will finish.
         */
        end: string;

        /**
         * Whether the timeslot belongs to an event favourited by the volunteer.
         */
        favourite?: boolean;

        /**
         * Whether the timeslot is not visible to regular visitors.
         */
        invisible?: boolean;

        /**
         * UNIX timestamp of the time when this timeslots is due to start. Only included to enable
         * sorting the results.
         */
        startTime: number;

        /**
         * Whether the event has finished already. Only included to enable sorting the results.
         */
        finished: boolean;

        /**
         * Optional styling that should be applied to this timeslot entry.
         */
        sx?: SxProps<Theme>;
    }[];
}

/**
 * Props accepted by the <LocationPage>.
 */
interface LocationPageProps {
    /**
     * Unique ID of the location to display on this page.
     */
    locationId: string;
}

/**
 * The <LocationPage> displays the activities that will be taking place in a particular location.
 * When only one such activity exists, the user will be redirected through immediately.
 */
export function LocationPage(props: LocationPageProps) {
    const { schedule } = useContext(ScheduleContext);

    // ---------------------------------------------------------------------------------------------

    const [ sections, soleActivityId ] = useMemo(() => {
        const sections: TimeslotSectionInfo[] = [ /* empty */ ];
        if (!schedule || !schedule.program.locations.hasOwnProperty(props.locationId))
            return [ sections, null ];

        const activities = new Set<string>;
        const timeslotsSections = new Map<string, TimeslotSectionInfo['timeslots'][number][]>;

        const currentTime = currentTimestamp();

        for (const timeslotId of schedule.program.locations[props.locationId].timeslots) {
            const timeslot = schedule.program.timeslots[timeslotId];
            const activity = schedule.program.activities[timeslot.activity];

            activities.add(timeslot.activity);

            const start = toZonedDateTime(timeslot.start);
            const end = toZonedDateTime(timeslot.end);

            // We consider timeslots that end before the `kLogicalDayChangeHour` to be part of the
            // previous day, to avoid confusion about when events will actually be happening.
            let startForSection = start;
            if (!!schedule.config.enableLogicalDays && end.hour <= kLogicalDayChangeHour)
                startForSection = start.subtract({ hours: kLogicalDayChangeHour });

            const section = formatDate(startForSection, 'dddd');
            if (!timeslotsSections.has(section))
                timeslotsSections.set(section, [ /* empty */ ]);

            let sx: SxProps<Theme> | undefined;
            if (timeslot.end <= currentTime) {
                sx = {
                    backgroundColor: 'animecon.pastBackground',
                    textDecoration: 'line-through',
                    textDecorationColor: theme => theme.palette.animecon.pastForeground,
                    '&:hover': {
                        backgroundColor: 'animecon.pastBackgroundHover',
                        textDecoration: 'line-through',
                        textDecorationColor: theme => theme.palette.animecon.pastForeground,
                    },
                };
            } else if (timeslot.start <= currentTime) {
                sx = {
                    backgroundColor: 'animecon.activeBackground',
                    '&:hover': {
                        backgroundColor: 'animecon.activeBackgroundHover',
                    },
                };
            }

            timeslotsSections.get(section)!.push({
                id: timeslotId,
                activityId: timeslot.activity,
                activity: activity.title,
                start: formatDate(start, 'HH:mm'),
                startTime: timeslot.start,
                finished: timeslot.end <= currentTime,
                end: formatDate(end, 'HH:mm'),
                favourite: !!schedule.favourites?.hasOwnProperty(timeslot.activity),
                invisible: activity.invisible,
                sx,
            });
        }

        for (const [ label, timeslots ] of timeslotsSections.entries()) {
            timeslots.sort((lhs, rhs) => {
                if (schedule.config.sortPastEventsLast && lhs.finished !== rhs.finished)
                    return lhs.finished ? 1 : -1;

                return lhs.startTime - rhs.startTime;
            });

            let finished: boolean = false;
            if (timeslots.length > 0) {
                finished = Math.round(toZonedDateTime(timeslots[0].startTime).with({
                    hour: 23,
                    minute: 59,
                    second: 59,
                }).epochMilliseconds / 1000) < currentTime;
            }

            sections.push({
                label,
                divider: false,
                finished,
                timeslots,
            });
        }

        sections.sort((lhs, rhs) => {
            if (schedule.config.sortPastDaysLast && lhs.finished !== rhs.finished)
                return lhs.finished ? 1 : -1;

            return lhs.timeslots[0].startTime - rhs.timeslots[0].startTime;
        });

        for (let index = 1; index < sections.length; ++index) {
            if (sections[index].finished === sections[0].finished)
                continue;

            sections[index].divider = true;
            break;
        }

        return [
            sections,
            activities.size === 1 ? [ ...activities ][0] : null,
        ];

    }, [ props.locationId, schedule ]);

    // ---------------------------------------------------------------------------------------------

    if (!schedule || !schedule.program.locations.hasOwnProperty(props.locationId)) {
        return (
            <ErrorCard title="This location cannot be found!">
                The location that you tried to access cannot be found.
            </ErrorCard>
        );
    }

    // If this location only hosts a single activity, forward the user through to the activity page
    // as it will contain the useful information, making this page redundant.
    if (!!soleActivityId)
        redirect(`/schedule/${schedule.slug}/events/${soleActivityId}`);

    const location = schedule.program.locations[props.locationId];
    const area = schedule.program.areas[location.area];

    return (
        <>
            <SetTitle title={location.name} />
            <HeaderSectionCard>
                <CardHeader title={location.name}
                            slotProps={{ title: { variant: 'subtitle1' } }}
                            subheader={area.name} />
            </HeaderSectionCard>
            { !sections.length &&
                <ErrorCard title="No scheduled events">
                    This location will not be hosting any events.
                </ErrorCard> }
            { sections.map(section =>
                <React.Fragment key={section.label}>
                    { section.divider && <Divider sx={{ pt: 1 }} /> }
                    <SubHeader>{section.label}</SubHeader>
                    <Card sx={{ mt: '8px !important' }}>
                        <List dense disablePadding>
                            {section.timeslots.map(timeslot => {
                                const href =
                                    `/schedule/${schedule.slug}/events/${timeslot.activityId}`;

                                return (
                                    <ListItemButton LinkComponent={Link} href={href}
                                                    key={timeslot.id} sx={timeslot.sx}>
                                        <ListItemEventText invisible={timeslot.invisible}
                                                           title={timeslot.activity} />
                                        <ListItemDetails>
                                            { !!timeslot.favourite && <InlineFavouriteStar /> }
                                            {timeslot.start}–{timeslot.end}
                                        </ListItemDetails>
                                    </ListItemButton>
                                );
                            } )}
                        </List>
                    </Card>
                </React.Fragment> )}
        </>
    );
}
