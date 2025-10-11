// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';

/**
 * CSS customizations applied to the <HeaderButton> component.
 */
const kHeaderButtonStyles: SxProps<Theme> = {
    py: 1,

    '& .MuiCardHeader-action': {
        paddingRight: 1,
        paddingTop: 1,
    },

    '& .MuiCardHeader-content': {
        minWidth: 0,
    },
};

/**
 * Props passed to the <LocationHeader> component.
 */
interface HeaderButtonProps {
    /**
     * The action that should be displayed in the header, if any.
     */
    action?: React.ReactNode;

    /**
     * URL of the page to navigate to when the header has been clicked on.
     */
    href: string;

    /**
     * The icon that should be shown on the right-hand side of the header.
     */
    icon?: React.ReactNode;

    /**
     * Text to display in the location header.
     */
    title: string;
}

/**
 * The <HeaderButton> component displays a <CardHeader> specific to an area or location. It's used
 * in various parts of the application, thus has been generalized.
 */
export function HeaderButton(props: HeaderButtonProps) {
    return (
        <CardActionArea LinkComponent={Link} href={props.href}>
            <CardHeader action={props.action} avatar={props.icon} sx={kHeaderButtonStyles}
                        title={props.title}
                        titleTypographyProps={{
                            color: 'primary',
                            fontWeight: 'normal',
                            noWrap: true,
                            variant: 'h6'
                        }} />
        </CardActionArea>
    );
}
