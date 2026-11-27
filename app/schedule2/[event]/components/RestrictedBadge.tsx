// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { PillBadge } from './PillBadge';

/**
 * Props accepted by the `<RestrictedBadge>` component.
 */
interface RestrictedBadgeProps {
    /**
     * Icon rendered inside the badge (e.g. a lock or visibility-off icon).
     */
    icon: React.ReactNode;

    /**
     * Whether to dim the icon-only badge (e.g. for past or finished rows).
     */
    muted?: boolean;

    /**
     * Optional horizontal margin applied to the badge in MUI spacing units.
     */
    mx?: number;

    /**
     * Optional label turning the badge into a warm-amber rounded pill with icon and text.
     */
    pillLabel?: string;

    /**
     * Tooltip text and accessible label describing the restriction.
     */
    title: string;
}

/**
 * Warm-amber restriction indicator rendered either as a subtle inline icon or as a rounded pill
 * with a caption label, wrapped in a MUI `<Tooltip>`.
 */
export function RestrictedBadge(props: RestrictedBadgeProps) {
    const { icon, muted = false, mx, pillLabel, title } = props;

    if (pillLabel) {
        return (
            <PillBadge
                icon={icon}
                label={
                    <Typography component="span" variant="caption" sx={{ fontWeight: 500 }}>
                        {pillLabel}
                    </Typography>
                }
                mx={mx}
                title={title}
                tone="warning" />
        );
    }

    return (
        <Tooltip title={title}>
            <Box
                component="span"
                aria-label={title}
                sx={{
                    alignItems: 'center',
                    color: 'warning.main',
                    display: 'inline-flex',
                    flexShrink: 0,
                    mx,
                    opacity: muted ? 0.55 : 0.92,
                    typography: 'caption',
                }}>
                {icon}
            </Box>
        </Tooltip>
    );
}
