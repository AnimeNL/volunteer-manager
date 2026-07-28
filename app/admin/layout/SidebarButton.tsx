// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import type SvgIcon from '@mui/material/SvgIcon';
import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import Tooltip, { type TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <SidebarButton> component.
 */
type SidebarButtonProps = {
    /**
     * Icon that visually represents what this button is about.
     */
    Icon: typeof SvgIcon;

    /**
     * Whether this button represents the active section in the administration area.
     */
    active?: boolean;

    /**
     * Callback that will be invoked when the button is clicked on.
     */
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;

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
            <SidebarIconButton LinkComponent={Link} sx={props.sx} { ...{ href: props.href }}
                               active={props.active} onClick={props.onClick}>
                <SidebarButtonTooltip title={props.title}>
                    <props.Icon />
                </SidebarButtonTooltip>
            </SidebarIconButton>
        );
    } else {
        return (
            <SidebarIconButton onClick={props.onClick} sx={props.sx} active={props.active}>
                <SidebarButtonTooltip title={props.title}>
                    <props.Icon />
                </SidebarButtonTooltip>
            </SidebarIconButton>
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
        color: theme.vars?.palette.primaryPalette[800],
     },
     [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: theme.vars?.palette.primaryPalette[800],
        color: theme.palette.primary.contrastText,
     },
}));

/**
 * Props accepted by the <SidebarIconButton> component.
 */
interface SidebarIconButtonProps extends IconButtonProps {
    /**
     * Whether this button represents the active section in the administration area.
     */
    active?: boolean;
}

/**
 * Variant of the <IconButton> that renders consistently regardless of the colour scheme being used,
 * as the navigation sidebar has a consistent set of colours. (Excluding any shown menus.)
 */
const SidebarIconButton = styled(({ active, ...props }: SidebarIconButtonProps) => (
    <IconButton {...props} />
))(({ active, theme }) => ({
    backgroundColor: active ? theme.vars?.palette.primaryPalette[800] : undefined,
    borderRadius: theme.vars?.shape.borderRadius,
    color: theme.vars?.palette.common.white,
    transition: theme.transitions.create('background-color'),

    '&:active, &:hover': {
        backgroundColor: theme.vars?.palette.primaryPalette[500]
    },
}));
