// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import ListItemButton from '@mui/material/ListItemButton';

import { InlineFavouriteStar } from './InlineFavouriteStar';
import { ListItemDetails } from './ListItemDetails';
import { ListItemEventText } from './ListItemEventText';
import { formatDate, type Temporal } from '@lib/Temporal';
import { isDifferentDay } from '../lib/isDifferentDay';
import { toZonedDateTime } from '../CurrentTime';

/**
 * Type definition of the information we need to know about a timeslot.
 */
export interface CardTimeslot {
    /**
     * Unique ID of the timeslot.
     */
    id: string;

    /**
     * Unique ID of the activity the timeslot belongs to.
     */
    activityId?: string;

    /**
     * UNIX timestamp indicating the time at which this timeslot will start.
     */
    start: number;

    /**
     * UNIX timestamp indicating the time at which this timeslot will finish.
     */
    end: number;

    /**
     * Title to show on the timeslot entry.
     */
    title: string;

    /**
     * Set when the timeslot belongs to an event favourited by the volunteer.
     */
    favourite?: boolean;

    /**
     * Set when the timeslot is invisible to the public.
     */
    invisible?: true;
}

/**
 * Props accepted by the <CardTimeslotEntry> component.
 */
interface CardTimeslotEntryProps {
    /**
     * Current Temporal ZonedDateTime based on which timing calculations will be done.
     */
    currentTime: Temporal.ZonedDateTime;

    /**
     * URL prefix to apply to the outgoing link for this item.
     */
    prefix: string;

    /**
     * The timeslots that this entry should display.
     */
    timeslot: CardTimeslot;
}

/**
 * The <CardTimeslotEntry> component shows a singular entry of a timeslot entry. The
 */
export function CardTimeslotEntry(props: CardTimeslotEntryProps) {
    const { currentTime, prefix, timeslot } = props;

    let sx: SxProps<Theme> = null;
    let time: React.ReactNode;

    const currentTimeEpochSeconds = Math.round(currentTime.epochMilliseconds / 1000);

    if (currentTimeEpochSeconds >= timeslot.end) {
        // Past events should not be shown as <CardTimeslotEntry> components. If we end up in here
        // then something is off; don't do any unnecessary work in addition to that.

    } else if (currentTimeEpochSeconds >= timeslot.start) {
        // Active events:

        const endZonedDateTime = toZonedDateTime(timeslot.end);

        time = `until ${formatDate(endZonedDateTime, 'HH:mm')}`;
        sx = {
            backgroundColor: 'animecon.activeBackground',
            '&:hover': {
                backgroundColor: 'animecon.activeBackgroundHover',
            }
        };

    } else {
        // Future events:

        const startZonedDateTime = toZonedDateTime(timeslot.start);
        const endZonedDateTime = toZonedDateTime(timeslot.end);

        const format = isDifferentDay(currentTime, startZonedDateTime) ? 'ddd, HH:mm' : 'HH:mm';
        time = `${formatDate(startZonedDateTime, format)}–${formatDate(endZonedDateTime, 'HH:mm')}`;
    }

    return (
        <ListItemButton LinkComponent={Link} href={`${prefix}/events/${timeslot.activityId}`}
                        sx={sx}>

            <ListItemEventText invisible={!!timeslot.invisible} title={timeslot.title} />

            { (!!time || !!timeslot.favourite) &&
                <ListItemDetails>
                    { !!timeslot.favourite && <InlineFavouriteStar /> }
                    { !!time && time }
                </ListItemDetails> }

        </ListItemButton>
    );
}
