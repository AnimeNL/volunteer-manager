// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useMemo } from 'react';

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

import type { VolunteerShiftInfo } from '../Types';
import { currentZonedDateTime, toZonedDateTime } from '../CurrentTime';
import { formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <UpcomingShiftCard> component.
 */
interface UpcomingShiftCardProps {
    /**
     * The shift that will soon start for the volunteer.
     */
    shift: VolunteerShiftInfo;

    /**
     * Unique slug of the current event.
     */
    slug: string;
}

/**
 * The <UpcomingShiftCard> displays a card that tells the volunteer which shift they've got coming
 * up next. We keep it simple, and it links through to their shift overview page.
 */
export function UpcomingShiftCard(props: UpcomingShiftCardProps) {
    const { shift, slug } = props;

    const startTime = useMemo(() => {
        const zonedDateTime = currentZonedDateTime();
        const zonedStartDateTime = toZonedDateTime(shift.startTime);

        if (zonedDateTime.dayOfYear === zonedStartDateTime.dayOfYear)
            return formatDate(zonedStartDateTime, '[at ]HH:mm');
        else
            return formatDate(zonedStartDateTime, '[on ]dddd[ at ]HH:mm');

    }, [ shift.startTime ]);

    return (
        <Card>
            <CardActionArea LinkComponent={Link} href={`/schedule/${slug}/shifts`}>
                <CardContent>
                    <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
                        Your next shift will be…
                    </Typography>
                    <Typography variant="h5">
                        {shift.title}
                    </Typography>
                    <Typography variant="body2">
                        {shift.location}, {startTime}
                    </Typography>
                </CardContent>
            </CardActionArea>
        </Card>
    );
}
