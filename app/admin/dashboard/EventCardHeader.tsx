// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CardMedia from '@mui/material/CardMedia';

import { useIsMobile } from '../lib/useIsMobile';

/**
 * Props accepted by the <EventCardHeader> component.
 */
interface EventCardHeaderProps {
    /**
     * URL to the image that should be shown as the upcoming event's logo.
     */
    src?: string;

    /**
     * Title of the upcoming event, provided for accessibility reasons.
     */
    title: string;
}

/**
 * The <EventCardHeader> component displays the upcoming event's logo in a responsive manner, i.e.
 * with an appropriate aspect ratio based on the available real estate.
 */
export function EventCardHeader(props: EventCardHeaderProps) {
    const isMobile = useIsMobile();

    const aspectRatio = isMobile ? 2.5 : 3;
    return (
        <CardMedia sx={{ aspectRatio, backgroundPositionY: '25%' }}
                   image={props.src || '/images/admin/event-header.jpg'}
                   title={props.title} />
    );
}
