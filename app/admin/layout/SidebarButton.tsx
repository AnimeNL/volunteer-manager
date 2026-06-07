// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import type SvgIcon from '@mui/material/SvgIcon';
import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import Tooltip, { type TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <SidebarButton> component.
 */
type SidebarButtonProps = {
    // TODO: active?

    /**
     * Icon that visually represents what this button is about.
     */
    Icon: typeof SvgIcon;

    /**
     * The system prop that allows defining system overrides as well as additional CSS styles.
     */
    sx?: IconButtonProps['sx'];

    /**
     * Title to display in the tooltip associated with this button.
     */
    title: string;

} & (
    {
        /**
         * URL that should be navigated to when the button is clicked on.
         */
        href: string;
    } |
    {
        /**
         * Callback that will be invoked when the button is clicked on.
         */
        onClick: (event: React.MouseEvent<HTMLElement>) => void;
    }
);

/**
 * The <SidebarButton> component corresponds to a button on the navigation sidebar, each with
 * consistent interaction until they are clicked.
 */
export function SidebarButton(props: SidebarButtonProps) {
    if ('href' in props) {
        return (
            <IconButton LinkComponent={Link} href={props.href} sx={props.sx}>
                <SidebarButtonTooltip title={props.title}>
                    <props.Icon />
                </SidebarButtonTooltip>
            </IconButton>
        );
    } else {
        return (
            <IconButton onClick={props.onClick} sx={props.sx}>
                <SidebarButtonTooltip title={props.title}>
                    <props.Icon />
                </SidebarButtonTooltip>
            </IconButton>
        );
    }
}

/**
 * Tooltip used to illustrate what the particular button will be used for. Will be displayed on the
 * right-hand side of the button in a dark variant of the primary theme colour.
 */
const SidebarButtonTooltip = styled(({ className, ...props }: TooltipProps) => (
     <Tooltip describeChild {...props} arrow placement="right" classes={{ popper: className }} />
))(({ theme }) => ({
     [`& .${tooltipClasses.arrow}`]: {
        color: theme.palette.primary.dark,
     },
     [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: theme.palette.primary.dark,
        color: theme.palette.primary.contrastText,
     },
}));
