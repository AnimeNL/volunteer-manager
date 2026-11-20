// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import ReadMoreIcon from '@mui/icons-material/ReadMore';

/**
 * Props accepted by the <TicketCard> component.
 */
interface TicketCardProps {
    /**
     * Short name of the event for which the card is being shown.
     */
    event: string;

    /**
     * Slug of the event for which the card is being shown.
     */
    slug: string;
}

/**
 * The <TicketCard> displays a card linking to the volunteer's event ticket and QR code. Shown on
 * the overview page until shortly after the volunteer's first shift.
 */
export function TicketCard(props: TicketCardProps) {
    return (
        <Card>
            <CardActionArea LinkComponent={Link} href={`/schedule/${props.slug}/ticket`}
                            sx={{ '& .MuiCardHeader-action': { alignSelf: 'center',
                                                               pr: 1, pt: 0.5 } }}>

                <CardHeader action={ <ReadMoreIcon color="disabled" /> }
                            avatar={ <ConfirmationNumberOutlinedIcon color="primary" /> }
                            title="Your ticket"
                            subheader={`Show it when arriving at ${props.event}`}
                            slotProps={{ title: { variant: 'subtitle2' } }} />

            </CardActionArea>
        </Card>
    );
}
