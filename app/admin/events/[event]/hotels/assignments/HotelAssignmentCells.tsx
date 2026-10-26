// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Typography from '@mui/material/Typography';

/**
 * Context passed to the <HotelOccupantCell> component.
 */
interface HotelOccupantCellContext {
    /**
     * Unique slug of the event for which hotel assignments are being displayed.
     */
    event: string;

    /**
     * Which occupant slot of the hotel room is being rendered.
     */
    occupant: 'first' | 'second' | 'third';
}

/**
 * Props accepted by the <HotelOccupantCell> component.
 */
interface HotelOccupantCellProps {
    /**
     * Context identifying the event and occupant slot.
     */
    context?: HotelOccupantCellContext;

    /**
     * The hotel booking row model being rendered.
     */
    row: {
        firstName?: string | null;
        firstUserId?: number | null;
        firstTeam?: string | null;

        secondName?: string | null;
        secondUserId?: number | null;
        secondTeam?: string | null;

        thirdName?: string | null;
        thirdUserId?: number | null;
        thirdTeam?: string | null;
    };
}

/**
 * Cell component for displaying an occupant of a hotel room, linking to their volunteer profile
 * when they are a volunteer participating in the event.
 */
export function HotelOccupantCell(props: HotelOccupantCellProps) {
    const occupant = props.context?.occupant ?? 'first';

    const name = props.row[`${occupant}Name`];
    if (!name) {
        return (
            <Typography variant="inherit" color="textDisabled" component="span"
                        sx={{ fontStyle: 'italic' }}>
                ···
            </Typography>
        );
    }

    const userId = props.row[`${occupant}UserId`];
    const team = props.row[`${occupant}Team`];

    if (!props.context?.event || !userId || !team)
        return <>{name}</>;

    const href = `/admin/events/${props.context.event}/${team}/volunteers/${userId}`;
    return (
        <MuiLink component={Link} href={href}>
            {name}
        </MuiLink>
    );
}
