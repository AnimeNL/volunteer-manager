// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useMemo } from 'react';

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import type { VolunteerShiftInfo } from '../Types';
import { Markdown } from '@components/Markdown';
import { formatDate } from '@lib/Temporal';
import { toZonedDateTime } from '../CurrentTime';

/**
 * Props accepted by the <ActiveShiftCard> component.
 */
interface ActiveShiftCardProps {
    /**
     * The shift that the volunteer is currently engaged in.
     */
    shift: VolunteerShiftInfo;

    /**
     * Unique slug of the current event.
     */
    slug: string;
}

/**
 * The <ActiveShiftCard> displays a card that tells the volunteer which shift they should currently
 * be engaged in. The shift's description is displayed inline, to give them quick access.
 */
export function ActiveShiftCard(props: ActiveShiftCardProps) {
    const { shift, slug } = props;

    const endTime = useMemo(() => {
        const zonedEndDateTime = toZonedDateTime(shift.endTime);
        return formatDate(zonedEndDateTime, 'HH:mm');

    }, [ shift.endTime ]);

    return (
        <Card sx={{ backgroundColor: 'animecon.activeBackground' }}>
            <CardActionArea LinkComponent={Link} href={`/schedule/${slug}/shifts`}>
                <CardContent>
                    <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
                        You're currently busy with…
                    </Typography>
                    <Typography variant="h5">
                        {shift.title}
                    </Typography>
                    <Typography variant="body2">
                        {shift.location}, until {endTime}
                    </Typography>
                    { !!shift.description &&
                        <>
                            <Divider sx={{ pt: 1, mb: 1 }} />
                            <Markdown defaultVariant="body2">{shift.description}</Markdown>
                        </> }
                </CardContent>
            </CardActionArea>
        </Card>
    );
}
