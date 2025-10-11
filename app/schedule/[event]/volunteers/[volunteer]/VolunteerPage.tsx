// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EventNoteIcon from '@mui/icons-material/EventNote';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NotesIcon from '@mui/icons-material/Notes';
import PhoneIcon from '@mui/icons-material/Phone';
import Stack from '@mui/material/Stack';
import StarIcon from '@mui/icons-material/Star';
import Tooltip from '@mui/material/Tooltip';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { Alert } from '../../components/Alert';
import { Avatar } from '@components/Avatar';
import { ErrorCard } from '../../components/ErrorCard';
import { HeaderSectionCard } from '../../components/HeaderSectionCard';
import { ListItemDetails } from '../../components/ListItemDetails';
import { NotesCard } from '../../components/NotesCard';
import { ScheduleContext } from '../../ScheduleContext';
import { SetTitle } from '../../components/SetTitle';
import { SubHeader } from '../../components/SubHeader';
import { callApi } from '@lib/callApi';
import { currentTimestamp, toZonedDateTime } from '../../CurrentTime';
import { formatDate, type Temporal } from '@lib/Temporal';

import { kEnforceSingleLine } from '../../Constants';
import { kLogicalDayChangeHour } from '../../lib/isDifferentDay';

const NotesEditorDialog = dynamic(() => import('../../components/NotesEditorDialog'), {
    ssr: false,
});

/**
 * Sorted and associated information regarding the a particular section of the volunteer's schedule,
 * grouped together in any number of sections, generally days. Includes both scheduled shifts and,
 * for the local volunteer, their starred events.
 */
interface ScheduleSection {
    /**
     * Label to assign to the section of their schedule.
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
     * The entries that are part of this section.
     */
    entries: {
        /**
         * Unique ID of this entry.
         */
        id: string;

        /**
         * Type of entry that is described.
         */
        type: 'favourite' | 'shift';

        /**
         * Unique ID of the activity this shift is associated with. Will be used to linkify.
         */
        activity: string;

        /**
         * Name of the entry as it should appear in their schedule.
         */
        name: string;

        /**
         * Time at which the entry will start.
         */
        start: string;

        /**
         * Time at which the entry will end.
         */
        end: string;

        /**
         * Time at which the entry will start, as a UNIX timestamp. Only included for sorting
         * purposes, should not be used to present to the user.
         */
        startTime: number;

        /**
         * Whether the entry has finished already. Only included to enable sorting the results.
         */
        finished: boolean;

        /**
         * Optional styling that should be applied to this entry.
         */
        sx?: SxProps<Theme>;

        /**
         * Optional styling that should be applied to this entry's text label.
         */
        sxPrimaryLabel?: SxProps<Theme>;
    }[];
}

/**
 * Determines the section that an event with the given |start| and |end| moments should be part of,
 * which depends on whether the logical day setting is enabled.
 */
function determineSection(
    start: Temporal.ZonedDateTime, end: Temporal.ZonedDateTime, enableLogicalDays: boolean): string
{
    let startForSection = start;

    // We consider shifts that end before the `kLogicalDayChangeHour` to be part of the
    // previous day, to avoid volunteer confusion about when shifts are meant to take place.
    if (enableLogicalDays && end.hour <= kLogicalDayChangeHour)
        startForSection = start.subtract({ hours: kLogicalDayChangeHour });

    return formatDate(startForSection, 'dddd');
}

/**
 * Determines the style that should be applied to a row on a volunteer's schedule, which is based
 * on the lifecycle stage of the shift or favourited entry that's being displayed.
 */
function determineSx(start: number, end: number, currentTime: number): SxProps<Theme> | undefined {
    if (end <= currentTime) {
        return {
            backgroundColor: 'animecon.pastBackground',
            textDecoration: 'line-through',
            textDecorationColor: theme => theme.palette.animecon.pastForeground,
            '&:hover': {
                backgroundColor: 'animecon.pastBackgroundHover',
                textDecoration: 'line-through',
                textDecorationColor: theme => theme.palette.animecon.pastForeground,
            },
        };
    }

    if (start <= currentTime) {
        return {
            backgroundColor: 'animecon.activeBackground',
            '&:hover': {
                backgroundColor: 'animecon.activeBackgroundHover',
            },
        };
    }

    return undefined;
}

/**
 * Props accepted by the <VolunteerPageProps> component.
 */
interface VolunteerPageProps {
    /**
     * Unique ID of the volunteer for whom the page should be shown.
     */
    userId: string;
}

/**
 * The <VolunteerPage> page displays an overview page of an individual volunteer, including their
 * details, contact information (when available), notes and shifts.
 */
export function VolunteerPage(props: VolunteerPageProps) {
    const { refresh, schedule } = useContext(ScheduleContext);

    const router = useRouter();

    // ---------------------------------------------------------------------------------------------
    // Scheduled shifts:
    // ---------------------------------------------------------------------------------------------

    const [ hasFavourites, hasShifts, isSelf, scheduleSections ] = useMemo(() => {
        let hasFavourites: boolean = false;
        let hasShifts: boolean = false;
        const isSelf = props.userId === `${schedule?.userId}`;
        const scheduleSections: ScheduleSection[] = [ /* empty */ ];

        if (!schedule)
            return [ hasFavourites, hasShifts, isSelf, scheduleSections ];  // incomplete |schedule|

        const currentTime = currentTimestamp();
        const enableLogicalDays = !!schedule.config.enableLogicalDays;

        const scheduledShiftSections = new Map<string, ScheduleSection['entries'][number][]>;
        if (schedule.volunteers.hasOwnProperty(props.userId)) {
            for (const scheduledShiftId of schedule.volunteers[props.userId].schedule) {
                const scheduledShift = schedule.schedule[scheduledShiftId];
                const shift = schedule.shifts[scheduledShift.shift];

                const start = toZonedDateTime(scheduledShift.start);
                const end = toZonedDateTime(scheduledShift.end);

                const section = determineSection(start, end, enableLogicalDays);
                if (!scheduledShiftSections.has(section))
                    scheduledShiftSections.set(section, [ /* empty */ ]);

                hasShifts = true;
                scheduledShiftSections.get(section)!.push({
                    id: scheduledShiftId,
                    type: 'shift',
                    activity: shift.activity,
                    name: shift.name,
                    start: formatDate(start, 'HH:mm'),
                    startTime: scheduledShift.start,
                    finished: scheduledShift.end <= currentTime,
                    end: formatDate(end, 'HH:mm'),
                    sx: determineSx(scheduledShift.start, scheduledShift.end, currentTime),
                    sxPrimaryLabel: kEnforceSingleLine,
                });
            }
        }

        if (!!schedule.config.enableFavourites && isSelf && !!schedule.favourites) {
            const sxPrimaryLabel: SxProps<Theme> = {
                ...kEnforceSingleLine,
                color: 'text.disabled',
                fontStyle: 'italic',
            };

            for (const activityId of Object.keys(schedule.favourites)) {
                if (!schedule.program.activities.hasOwnProperty(activityId))
                    continue;  // the |activityId| no longer exists

                const activity = schedule.program.activities[activityId];
                for (const timeslotId of activity.timeslots) {
                    if (!schedule.program.timeslots.hasOwnProperty(timeslotId))
                        continue;  // the |activity| refers to an invalid |timeslotId|

                    const timeslot = schedule.program.timeslots[timeslotId];

                    const start = toZonedDateTime(timeslot.start);
                    const end = toZonedDateTime(timeslot.end);

                    const section = determineSection(start, end, enableLogicalDays);
                    if (!scheduledShiftSections.has(section))
                        scheduledShiftSections.set(section, [ /* empty */ ]);

                    hasFavourites = true;
                    scheduledShiftSections.get(section)!.push({
                        id: `f/${activityId}`,
                        type: 'favourite',
                        activity: activityId,
                        name: activity.title,
                        start: formatDate(start, 'HH:mm'),
                        startTime: timeslot.start,
                        finished: false,
                        end: formatDate(end, 'HH:mm'),
                        sx: determineSx(timeslot.start, timeslot.end, currentTime),
                        sxPrimaryLabel,
                    });
                }
            }
        }

        for (const [ label, entries ] of scheduledShiftSections.entries()) {
            entries.sort((lhs, rhs) => {
                if (schedule.config.sortPastEventsLast && lhs.finished !== rhs.finished)
                    return lhs.finished ? 1 : -1;

                return lhs.startTime - rhs.startTime;
            });

            let finished: boolean = false;
            if (entries.length > 0) {
                finished = Math.round(toZonedDateTime(entries[0].startTime).with({
                    hour: 23,
                    minute: 59,
                    second: 59,
                }).epochMilliseconds / 1000) < currentTime;
            }

            scheduleSections.push({
                label,
                divider: false,
                finished,
                entries,
            });
        }

        scheduleSections.sort((lhs, rhs) => {
            if (schedule.config.sortPastDaysLast && lhs.finished !== rhs.finished)
                return lhs.finished ? 1 : -1;

            return lhs.entries[0].startTime - rhs.entries[0].startTime;
        });

        for (let index = 1; index < scheduleSections.length; ++index) {
            if (scheduleSections[index].finished === scheduleSections[0].finished)
                continue;

            scheduleSections[index].divider = true;
            break;
        }

        return [ hasFavourites, hasShifts, isSelf, scheduleSections ];

    }, [ props.userId, schedule ]);

    // ---------------------------------------------------------------------------------------------
    // Avatar management:
    // ---------------------------------------------------------------------------------------------

    // Volunteers are able to edit their own avatar by default, and can be granted a permission that
    // will allow them to edit anyone's avatar. That permission is conveyed as a config option.
    const avatarEditable = isSelf || schedule?.config.enableAvatarManagement;

    // Called when a new avatar has been selected that hsould be uploaded to the server.
    const handleAvatarChange = useCallback(async (avatar: Blob) => {
        try {
            const base64Header = 'data:image/png;base64,';
            const base64Avatar = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend =
                    () => resolve((reader.result as string).substring(base64Header.length));
                reader.readAsDataURL(avatar);
            });

            const response = await callApi('post', '/api/auth/update-avatar', {
                avatar: base64Avatar as string,
                overrideUserId: parseInt(props.userId, /* radix= */ 10),
            });

            if (response.success) {
                refresh?.();
                router.refresh();
            }

            return response.success;

        } catch (error) {
            console.error('Unable to upload a new avatar:', error);
        }

        return false;

    }, [ props.userId, refresh, router ]);

    // ---------------------------------------------------------------------------------------------
    // Notes management:
    // ---------------------------------------------------------------------------------------------

    const [ noteEditorOpen, setNoteEditorOpen ] = useState<boolean>(false);

    const handleCloseNotes = useCallback(() => setNoteEditorOpen(false), [ /* no deps */ ]);
    const handleOpenNotes = useCallback(() => setNoteEditorOpen(true), [ /* no deps */ ]);

    const handleSubmitNotes = useCallback(async (notes: string) => {
        if (!schedule)
            return false;  // unable to update notes when the event is not known

        const response = await callApi('put', '/api/event/schedule/notes', {
            event: schedule.slug,
            userId: parseInt(props.userId, /* radix= */ 10),
            notes,
        });

        if (!!response.success) {
            refresh?.();
            router.refresh();
        }

        return response.success;

    }, [ props.userId, refresh, router, schedule ]);

    // ---------------------------------------------------------------------------------------------

    if (!schedule)
        return undefined;  // the page is still loading

    let isFakeVolunteer: boolean = false;
    let volunteer = schedule.volunteers[props.userId];

    if (!volunteer) {
        if (!hasFavourites) {
            return (
                <ErrorCard title="This volunteer cannot be found!">
                    The volunteer you tried to access does not participate in this event.
                </ErrorCard>
            );
        }

        // Create a fake `volunteer` entry. This is the case where someone is not participating in
        // the given event, but has still been granted access to the portal, *and* has favourited
        // one or more events during the event that should be displayed.
        isFakeVolunteer = true;

        volunteer = {
            schedule: [],
            id: '12',
            name: 'Your favourited events',
            team: 'Guests',
            role: schedule.event,
        };
    }

    let phoneNumber: string | undefined;
    let whatsAppNumber: string | undefined;

    if (!!volunteer.phoneNumber) {
        phoneNumber = `tel:${volunteer.phoneNumber}`;
        whatsAppNumber = `https://wa.me/${volunteer.phoneNumber.replace(/^\+/, '')}`;
    }

    return (
        <>
            <SetTitle title={volunteer.name} />
            <HeaderSectionCard>
                <CardHeader title={volunteer.name}
                            subheader={volunteer.role}
                            slotProps={{ title: { variant: 'subtitle2' } }}
                            sx={{ '& .MuiCardHeader-action': { alignSelf: 'center' },
                                  '& .MuiCardHeader-content': kEnforceSingleLine,
                                  '& .MuiCardHeader-content>:first-child': { display: 'inline' } }}
                            action={
                                <Stack direction="row" spacing={1} sx={{ pr: 1 }}>
                                    { !!schedule.config.enableNotesEditor &&
                                        <Tooltip title="Edit their notes">
                                            <IconButton onClick={handleOpenNotes}>
                                                <EditNoteIcon color="primary" />
                                            </IconButton>
                                        </Tooltip> }
                                    { !!phoneNumber &&
                                        <Tooltip title="Give them a call">
                                            <IconButton LinkComponent={Link} href={phoneNumber}>
                                                <PhoneIcon color="primary" />
                                            </IconButton>
                                        </Tooltip> }
                                    { !!whatsAppNumber &&
                                        <Tooltip title="Send them a WhatsApp message">
                                            <IconButton LinkComponent={Link} href={whatsAppNumber}
                                                        target="_blank">
                                                <WhatsAppIcon color="primary" />
                                            </IconButton>
                                        </Tooltip> }
                                </Stack>
                            }
                            avatar={
                                <Avatar editable={avatarEditable && !isFakeVolunteer}
                                        src={volunteer.avatar} onChange={handleAvatarChange}>
                                    {volunteer.name}
                                </Avatar>
                            } />
            </HeaderSectionCard>
            { !!volunteer.notes &&
                <NotesCard icon={ <NotesIcon color="primary" /> }
                           title="Notes"
                           notes={volunteer.notes} /> }
            { (!hasShifts && !isFakeVolunteer) &&
                <Alert severity="warning">
                    { isSelf && 'Your shifts haven\'t been scheduled yet' }
                    { !isSelf && `${volunteer.name} hasn't been given any shifts just yet` }
                </Alert>}
            { (!!hasShifts && !!hasFavourites) &&
                <Alert severity="warning">
                    Your schedule contains both shifts and favorited events—take care not to confuse
                    them
                </Alert> }
            { scheduleSections.map(section =>
                <React.Fragment key={section.label}>
                    { section.divider && <Divider sx={{ pt: 1 }} /> }
                    <SubHeader>{section.label}</SubHeader>
                    <Card sx={{ mt: '8px !important' }}>
                        <List dense disablePadding>
                            {section.entries.map(entry => {
                                const href = `/schedule/${schedule.slug}/events/${entry.activity}`;
                                return (
                                    <ListItemButton LinkComponent={Link} href={href} key={entry.id}
                                                    sx={entry.sx}>
                                        { entry.type === 'favourite' &&
                                            <ListItemIcon sx={{ minWidth: '32px', mt: '-1px' }}>
                                                <StarIcon color="disabled" fontSize="inherit" />
                                            </ListItemIcon> }
                                        { (entry.type === 'shift' && hasFavourites) &&
                                            <ListItemIcon sx={{ minWidth: '32px', mt: '-1px' }}>
                                                <EventNoteIcon color="primary" fontSize="inherit" />
                                            </ListItemIcon> }
                                        <ListItemText primary={entry.name}
                                                      slotProps={{
                                                          primary: { sx: entry.sxPrimaryLabel }
                                                      }} />
                                        <ListItemDetails>
                                            {entry.start}–{entry.end}
                                        </ListItemDetails>
                                    </ListItemButton>
                                );
                            } )}
                        </List>
                    </Card>
                </React.Fragment> )}
            { !!schedule.config.enableNotesEditor &&
                <NotesEditorDialog onClose={handleCloseNotes} onSubmit={handleSubmitNotes}
                                   notes={volunteer.notes} open={noteEditorOpen} /> }
        </>
    );
}
