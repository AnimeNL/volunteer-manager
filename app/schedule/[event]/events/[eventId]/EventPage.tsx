// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import type React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import NotesIcon from '@mui/icons-material/Notes';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { ErrorCard } from '../../components/ErrorCard';
import { HeaderSectionCard } from '../../components/HeaderSectionCard';
import { ListItemDetails } from '../../components/ListItemDetails';
import { ScheduleContext } from '../../ScheduleContext';
import { Section } from '../../components/Section';
import { SetTitle } from '../../components/SetTitle';
import { SoldOutWarning } from '../../components/SoldOutWarning';
import { formatDate } from '@lib/Temporal';
import { currentTimestamp, toZonedDateTime } from '../../CurrentTime';
import { NotesCard } from '../../components/NotesCard';

import { kEnforceSingleLine } from '../../Constants';
import { callApi } from '@lib/callApi';

/**
 * Information cached for a shift description box on the event page.
 */
interface DescriptionInfo {
    /**
     * Unique ID of the description box.
     */
    id: string;

    /**
     * Name of the team for whom the description is in scope.
     */
    team: string;

    /**
     * HTML colour that represents the identity of the aforementioned team.
     */
    teamColour: string;

    /**
     * Description associated with the shift. May contain Markdown.
     */
    description: string;
}

/**
 * Information cached for a timeslot entry on the event page.
 */
interface TimeslotInfo {
    /**
     * Unique ID of the timeslot.
     */
    id: string;

    /**
     * URL that contains more information about this particular location.
     */
    href: string;

    /**
     * Location in which the timeslot will be hosted.
     */
    location: string;

    /**
     * Timings of the timeslot, i.e. when does it start and finish?
     */
    timings: string;

    /**
     * UNIX timestamp of the time at which this timeslot starts. Only included for sorting purposes.
     */
    startTime: number;

    /**
     * Whether the timeslot has finished already. Only included for sorting purposes.
     */
    finished: boolean;

    /**
     * Optional styling that should be applied to the timeslot entry.
     */
    sx?: SxProps<Theme>;
}

/**
 * Information cached for a volunteer entry on the event page.
 */
interface VolunteerInfo {
    /**
     * Unique ID of the volunteer.
     */
    id: string;

    /**
     * URL that contains more information about this particular volunteer.
     */
    href: string;

    /**
     * Name of the volunteer as is appropriate to present to other volunteers.
     */
    name: string;

    /**
     * Timings of the shift, i.e. when does it start and finish?
     */
    timings: string;

    /**
     * UNIX timestamp of the time at which this shift starts. Only included for sorting purposes.
     */
    startTime: number;

    /**
     * Whether the volunteer shift has finished already. Only included for sorting purposes.
     */
    finished: boolean;

    /**
     * Optional styling that should be applied to the volunteer entry.
     */
    sx?: SxProps<Theme>;
}

/**
 * Props accepted by the <EventPage>.
 */
interface EventPageProps {
    /**
     * Unique ID of the activity this page will be shown for.
     */
    activityId: string;
}

/**
 * The <EventPage> displays the information associated with a particular event, such as a tasting
 * or a movie showing. General information will be listed, as well as shift descriptions and
 * volunteers assigned to work at this location.
 */
export function EventPage(props: EventPageProps) {
    const { refresh, schedule } = useContext(ScheduleContext);

    // ---------------------------------------------------------------------------------------------

    const [ descriptions, eventLocation, favourited, timeslots, timeslotsHidden,
            volunteers ] = useMemo(() =>
    {
        const descriptions: DescriptionInfo[] = [ /* empty */ ];
        const timeslots: TimeslotInfo[] = [ /* empty */ ];
        const volunteers: VolunteerInfo[] = [ /* empty */ ];

        const currentTime = currentTimestamp();

        let eventLocation: string | undefined;
        let favourited: boolean = false;
        let timeslotsHidden: boolean = false;

        if (!!schedule && !!schedule.config.enableFavourites)
            favourited = !!schedule.favourites?.hasOwnProperty(props.activityId);

        if (!!schedule && schedule.program.activities.hasOwnProperty(props.activityId)) {
            const activity = schedule.program.activities[props.activityId];
            timeslotsHidden = !!activity.timeslotsHidden;

            for (const timeslotId of activity.timeslots) {
                const timeslot = schedule.program.timeslots[timeslotId];
                const location = schedule.program.locations[timeslot.location];

                if (!!eventLocation && eventLocation !== location.name)
                    eventLocation = 'Multiple locations…';
                else
                    eventLocation = location.name;

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

                const start = toZonedDateTime(timeslot.start);
                const end = toZonedDateTime(timeslot.end);

                timeslots.push({
                    id: timeslotId,
                    href: `/schedule/${schedule.slug}/locations/${timeslot.location}`,
                    location: location.name,
                    timings: `${formatDate(start, 'ddd, HH:mm')}–${formatDate(end, 'HH:mm')}`,
                    startTime: timeslot.start,
                    finished: timeslot.end < currentTime,
                    sx,
                });
            }

            // Sort the timeslots by their date/time, in ascending order.
            timeslots.sort((lhs, rhs) => {
                if (schedule.config.sortPastEventsLast && lhs.finished !== rhs.finished)
                    return lhs.finished ? 1 : -1;

                return lhs.startTime - rhs.startTime;
            });

            const descriptionSet = new Set<string>;

            for (const scheduledShiftId of activity.schedule) {
                const scheduledShift = schedule.schedule[scheduledShiftId];

                const shift = schedule.shifts[scheduledShift.shift];
                const volunteer = schedule.volunteers[scheduledShift.volunteer];

                if (!!shift.description && !descriptionSet.has(shift.team)) {
                    const team = schedule.teams[shift.team];
                    descriptions.push({
                        id: shift.id,
                        team: team.name,
                        teamColour: team.colour,
                        description: shift.description,
                    });

                    descriptionSet.add(shift.team);
                }

                let sx: SxProps<Theme> | undefined;
                if (scheduledShift.end <= currentTime) {
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
                } else if (scheduledShift.start <= currentTime) {
                    sx = {
                        backgroundColor: 'animecon.activeBackground',
                        '&:hover': {
                            backgroundColor: 'animecon.activeBackgroundHover',
                        },
                    };
                }

                const start = toZonedDateTime(scheduledShift.start);
                const end = toZonedDateTime(scheduledShift.end);

                volunteers.push({
                    id: scheduledShiftId,
                    href: `/schedule/${schedule.slug}/volunteers/${volunteer.id}`,
                    name: volunteer.name,
                    timings: `${formatDate(start, 'ddd, HH:mm')}–${formatDate(end, 'HH:mm')}`,
                    startTime: scheduledShift.start,
                    finished: scheduledShift.end < currentTime,
                    sx,
                });
            }

            // Sort the descriptions by the associated team's name, in ascending order.
            descriptions.sort((lhs, rhs) => lhs.team.localeCompare(rhs.team));

            // Sort the volunteers first by the date/time of their shift, in ascending order, then
            // by their name secondary.
            volunteers.sort((lhs, rhs) => {
                if (schedule.config.sortPastEventsLast && lhs.finished !== rhs.finished)
                    return lhs.finished ? 1 : -1;

                if (lhs.startTime === rhs.startTime)
                    return lhs.name.localeCompare(rhs.name);

                return lhs.startTime - rhs.startTime;
            });
        }

        return [
            descriptions,
            eventLocation ?? 'AnimeCon',
            favourited,
            timeslots,
            timeslotsHidden,
            volunteers
        ];

    }, [ props.activityId, schedule ]);

    // ---------------------------------------------------------------------------------------------

    const [ favouriteConfirmationOpen, setFavouriteConfirmationOpen ] = useState<boolean>(false);
    const [ favouriteConfirmation, setFavouriteConfirmation ] =
        useState<null | 'added' | 'removed'>(null);

    const handleCloseFavouriteConfirmation = useCallback(() => {
        setFavouriteConfirmationOpen(false);
    }, [ /* no dependencies */ ]);

    const handleFavouriteChange = useCallback(async () => {
        if (!refresh || !schedule || !schedule.config.enableFavourites)
            return;  // the feature is disabled

        try {
            const response = await callApi('put', '/api/event/schedule/favourite', {
                event: schedule.slug,
                activityId: props.activityId,
            });

            if (!response.success) {
                console.error('Failed to store the favourite status:', response.error);
                return;
            }

            await refresh();

            setFavouriteConfirmationOpen(true);
            setFavouriteConfirmation(!!response.favourited ? 'added' : 'removed');

        } catch (error: any) {
            console.error('Failed to update the favourite status:', error);
            return;
        }

    }, [ props.activityId, refresh, schedule ]);

    let action: React.ReactNode;
    if (!!schedule && !!schedule.config.enableFavourites) {
        action = (
            <>
                { !favourited &&
                    <Tooltip title="Star this event">
                        <IconButton onClick={handleFavouriteChange}>
                            <StarOutlineIcon color="primary" />
                        </IconButton>
                    </Tooltip> }
                { !!favourited &&
                    <Tooltip title="Unstar this event">
                        <IconButton onClick={handleFavouriteChange}>
                            <StarIcon color="primary" />
                        </IconButton>
                    </Tooltip> }
                <Snackbar open={!!favouriteConfirmationOpen} autoHideDuration={2000}
                          onClose={handleCloseFavouriteConfirmation}
                          message={
                              favouriteConfirmation === 'added'
                                  ? 'Added to favourites'
                                  : 'Removed from favourites' } />
            </>
        );
    }

    // ---------------------------------------------------------------------------------------------

    if (!schedule || !schedule.program.activities.hasOwnProperty(props.activityId)) {
        return (
            <ErrorCard title="This event cannot be found!">
                The event that you tried to access cannot be found.
            </ErrorCard>
        );
    }

    const activity = schedule.program.activities[props.activityId];

    return (
        <>
            <SetTitle title={activity.title} />
            <HeaderSectionCard>
                <CardHeader title={activity.title} subheader={eventLocation} action={action}
                            slotProps={{
                                action: { sx: { alignSelf: 'center', pl: 2 } },
                                content: { sx: { minWidth: 0 } },
                                subheader: { sx: kEnforceSingleLine },
                                title: { variant: 'subtitle2', sx: kEnforceSingleLine }
                            }} />
            </HeaderSectionCard>
            { descriptions.map(description =>
                <NotesCard key={description.id}
                           icon={ <NotesIcon htmlColor={description.teamColour} /> }
                           title={description.team}
                           notes={description.description} />  )}
            { (timeslots.length > 0 && !timeslotsHidden) &&
                <Section header="Timeslots">
                    <List dense disablePadding>
                        { timeslots.map(timeslot =>
                            <ListItemButton LinkComponent={Link} href={timeslot.href}
                                            key={timeslot.id} sx={timeslot.sx}>
                                <ListItemText primary={timeslot.location}
                                              slotProps={{ primary: { sx: kEnforceSingleLine} }} />
                                <ListItemDetails>
                                    {timeslot.timings}
                                </ListItemDetails>
                            </ListItemButton> )}
                    </List>
                </Section> }
            { (!!activity.products && activity.products.length > 0) &&
                <Section header="Tickets sold">
                    <List dense disablePadding>
                        { activity.products.map((product, index) =>
                            <ListItem key={index}>
                                <ListItemText primary={product.product}
                                              slotProps={{ primary: { sx: kEnforceSingleLine} }} />
                                <ListItemDetails>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        { (!!product.limit && product.sold >= product.limit) &&
                                            <Typography variant="caption" color="error">
                                                sold out ({product.sold})
                                            </Typography> }
                                        { (!product.limit || product.sold < product.limit) &&
                                            <Typography variant="caption">
                                                { !product.limit && `${product.sold}` }
                                                { !!product.limit &&
                                                    <>
                                                        {product.sold}{' '}
                                                        <Typography variant="inherit"
                                                                    component="span"
                                                                    color="text.disabled">
                                                            / {product.limit}
                                                        </Typography>
                                                    </> }
                                            </Typography> }
                                        { !!product.price &&
                                            <Typography variant="inherit" color="inherit">
                                                — €{product.price}
                                            </Typography> }
                                    </Stack>
                                </ListItemDetails>
                            </ListItem> )}
                    </List>
                </Section> }
            { !!activity.soldOut && <SoldOutWarning /> }
            { !!volunteers.length &&
                <Section header="Volunteers">
                    <List dense disablePadding>
                        { volunteers.map(volunteer =>
                            <ListItemButton LinkComponent={Link} href={volunteer.href}
                                            key={volunteer.id} sx={volunteer.sx}>
                                <ListItemText primary={volunteer.name}
                                              slotProps={{ primary: { sx: kEnforceSingleLine} }} />
                                <ListItemDetails>
                                    {volunteer.timings}
                                </ListItemDetails>
                            </ListItemButton> )}
                    </List>
                </Section> }
        </>
    );
}
