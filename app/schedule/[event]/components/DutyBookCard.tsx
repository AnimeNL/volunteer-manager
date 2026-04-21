// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import Badge from '@mui/material/Badge';
import BookIcon from '@mui/icons-material/Book';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';
import ReadMoreIcon from '@mui/icons-material/ReadMore';

/**
 * Props accepted by the <DutyBookCard> component.
 */
interface DutyBookCardProps {
    /**
     * Short name of the event for which the card is being shown.
     */
    event: string;

    /**
     * Slug of the event for which the card is being shown.
     */
    slug: string;

    /**
     * Number of unread Duty Book items that the signed in user hasn't seen yet.
     */
    unread?: number;
}

/**
 * The <DutyBookCard> displays a card that provides access to the Duty Book. It's only shown on
 * mobile devices, as a link is added to the left-hand side menu for larger screen devices.
 */
export function DutyBookCard(props: DutyBookCardProps) {
    return (
        <Card>
            <CardActionArea LinkComponent={Link} href={`/schedule/${props.slug}/duty-book`}
                            sx={{ '& .MuiCardHeader-action': { alignSelf: 'center',
                                                               pr: 1, pt: 0.5 } }}>

                <CardHeader action={
                                <Badge badgeContent={props.unread} color="error">
                                    <ReadMoreIcon color="disabled" />
                                </Badge> }
                            avatar={ <BookIcon color="primary" /> }
                            title="Duty book"
                            subheader={`${props.event} incident records`}
                            slotProps={{ title: { variant: 'subtitle2' } }} />

            </CardActionArea>
        </Card>
    );
}
