// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CardMedia from '@mui/material/CardMedia';

import { useIsMobile } from '../lib/useIsMobile';

/**
 * Props accepted by the <DashboardCardHeader> component.
 */
interface DashboardCardHeaderProps {
    /**
     * Whether this is a secondary header. The aspect ratio will be slightly amended.
     */
    secondary?: boolean;

    /**
     * URL to the image that should be shown on the header.
     */
    src?: string;

    /**
     * Title of the upcoming event, provided for accessibility reasons.
     */
    title: string;
}

/**
 * The <DashboardCardHeader> component displays the image in a responsive manner, i.e. with an
 * appropriate aspect ratio based on the available real estate.
 */
export function DashboardCardHeader(props: DashboardCardHeaderProps) {
    const isMobile = useIsMobile();

    const kPrimaryAspectRatioDesktop = 3;
    const kPrimaryAspectRatioMobile = 2.5;

    const kSecondaryAspectRatioDesktop = 4;
    const kSecondaryAspectRatioMobile = 4.5;

    const aspectRatio =
        isMobile ? !props.secondary ? kPrimaryAspectRatioMobile : kSecondaryAspectRatioMobile
                 : !props.secondary ? kPrimaryAspectRatioDesktop : kSecondaryAspectRatioDesktop;

    return (
        <CardMedia sx={{ aspectRatio, backgroundPositionY: '85%' }}
                   image={props.src || '/images/admin/event-header.jpg'}
                   title={props.title} />
    );
}
