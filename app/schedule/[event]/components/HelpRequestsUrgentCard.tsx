// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';

import { Alert } from '../components/Alert';

/**
 * Props accepted by the <HelpRequestsUrgentCard> component.
 */
interface HelpRequestsUrgentCardProps {
    /**
     * Number of pending help requests that are still to be answered.
     */
    pending: number;

    /**
     * Slug of the event for which the card is being shown.
     */
    slug: string;
}

/**
 * The <HelpRequestsUrgentCard> displays a card that urges the reader to go to the help requests
 * page and answer an incoming call. It's important that such requests are dealt with quickly.
 */
export function HelpRequestsUrgentCard(props: HelpRequestsUrgentCardProps) {
    return (
        <Card>
            <CardActionArea LinkComponent={Link} href={`/schedule/${props.slug}/help-requests`}>
                <Alert severity="error" variant="filled">
                    { props.pending === 1 && 'There is one outstanding help request' }
                    { props.pending !== 1 &&
                        `There are ${props.pending} outstanding help requests` }
                </Alert>
            </CardActionArea>
        </Card>
    );
}
