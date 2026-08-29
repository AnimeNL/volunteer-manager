// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { useIsMobile } from '../lib/useIsMobile';

/**
 * Props accepted by the <DashboardCardHeader> component.
 */
interface DashboardCardHeaderProps {
    /**
     * Whether to render the title on top of the card's media.
     */
    renderTitle?: boolean;

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
    const kSecondaryAspectRatioMobile = 7;

    const aspectRatio =
        isMobile ? !props.secondary ? kPrimaryAspectRatioMobile : kSecondaryAspectRatioMobile
                 : !props.secondary ? kPrimaryAspectRatioDesktop : kSecondaryAspectRatioDesktop;

    const backgroundPositionY = isMobile && !!props.secondary ? '85%' : '85%';

    return (
        <CardMediaContainer>
            <CardMedia sx={{ aspectRatio, backgroundPositionY }}
                       image={props.src || '/images/admin/event-header.jpg'}
                       title={props.title} />
            { props.renderTitle &&
                <DashboardCardTitle title={props.title} /> }
        </CardMediaContainer>
    );
}

/**
 * Component displaying the card's title on a black, transparent overlay.
 */
function DashboardCardTitle(props: Pick<DashboardCardHeaderProps, 'title'>) {
    return (
        <CardHeaderContainer>
            <CardHeaderTypography noWrap variant="h6">
                {props.title}
            </CardHeaderTypography>
        </CardHeaderContainer>
    );
}

/**
 * Container for the card's header title, given a dark background to ensure readable text.
 */
const CardHeaderContainer = styled('div')(({ theme }) => ({
    position: 'absolute',

    bottom: 0,
    left: 0,
    padding: theme.spacing(4, 2, 1, 2),
    width: '100%',

    background:
        'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
    color: '#fff',
}));

/**
 * Typography, again adjusted to ensure readability.
 */
const CardHeaderTypography = styled(Typography)(() => ({
    textShadow: '0 1px 3px rgba(0,0,0,0.8)'
}));

/**
 * Container for the card's media element, to provide a stacking context.
 */
const CardMediaContainer = styled('div')(() => ({
    position: 'relative',
}));
