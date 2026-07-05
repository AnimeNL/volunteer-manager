// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <EventCardHighlight> component.
 */
interface EventCardHighlightProps {
    /**
     * URL that the user should navigate to when clicking on the highlight.
     */
    href: string;

    /**
     * Name of the event that recently finished.
     */
    name: string;
}

/**
 * The <EventCardHighlight> component displays a highlight towards the most recently concluded event
 * as it's likely the signed in user might still want to consult it.
 */
export function EventCardHighlight(props: EventCardHighlightProps) {
    return (
        <HighlightContainer direction="row">
            <HighlightButton component={Link} href={props.href}>
                Looking for {props.name}?
            </HighlightButton>
            <IconButton component={Link} href={props.href} size="small" sx={{ mr: 1 }}>
                <NavigateNextIcon />
            </IconButton>
        </HighlightContainer>
    );
}

/**
 * Styled variant of the container in which the highlight buttons will be positioned. Will take a
 * subtle variant of the theme's colour.
 */
const HighlightContainer = styled(Stack)(({ theme }) => ({
    alignItems: 'center',
    backgroundColor:
        `color-mix(in oklch, ${theme.vars?.palette.info.main} 20%, ${theme.vars?.palette.background.paper})`,
    borderTop: `1px solid ${theme.vars?.palette.divider}`,
}));

/**
 * Styled variant of MUI's base button, to take up the full width and height.
 */
const HighlightButton = styled(ButtonBase)<{ component?: React.ElementType, href?: string }>(
    ({ theme }) => ({
        flexGrow: 1,
        justifyContent: 'flex-start',
        padding: theme.spacing(1, 0, 1, 2),
    }
));
