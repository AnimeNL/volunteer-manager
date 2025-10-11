// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';
import NotListedLocationOutlinedIcon from '@mui/icons-material/NotListedLocationOutlined';
import ReadMoreIcon from '@mui/icons-material/ReadMore';

/**
 * Props accepted by the <HelpRequestsCard> component.
 */
interface HelpRequestsCardProps {
    /**
     * Number of pending help requests that are still to be answered.
     */
    pending?: number;

    /**
     * Slug of the event for which the card is being shown.
     */
    slug: string;
}

/**
 * The <HelpRequestsCard> displays a card that provides access to the pending help requests. On
 * desktop a menu entry is shown, whereas on mobile a card will be included on the overview page.
 */
export function HelpRequestsCard(props: HelpRequestsCardProps) {
    let subheader: string;

    if (!props.pending)
        subheader = 'See help requests issued by our displays';
    else if (props.pending === 1)
        subheader = 'There is one outstanding help request';
    else
        subheader = `There are ${props.pending} outstanding help requests`;

    return (
        <Card>
            <CardActionArea LinkComponent={Link} href={`/schedule/${props.slug}/help-requests`}
                            sx={{ '& .MuiCardHeader-action': { alignSelf: 'center',
                                                               pr: 1, pt: 0.5 } }}>

                <CardHeader action={ <ReadMoreIcon color="disabled" /> }
                            avatar={ <NotListedLocationOutlinedIcon color="primary" /> }
                            title="Help requests" titleTypographyProps={{ variant: 'subtitle2' }}
                            subheader={subheader} />

            </CardActionArea>
        </Card>
    );
}
