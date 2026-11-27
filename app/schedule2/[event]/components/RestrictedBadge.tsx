// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

/**
 * Warm-amber pill background colour mixed from the theme's warning accent.
 */
const kWarningTintBg = 'color-mix(in srgb, var(--mui-palette-warning-main) 13%, transparent)';

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
            <Tooltip title={title}>
                <Stack
                    component="span"
                    direction="row"
                    spacing={0.5}
                    useFlexGap
                    aria-label={title}
                    sx={{
                        alignItems: 'center',
                        bgcolor: kWarningTintBg,
                        borderRadius: 99,
                        color: 'warning.main',
                        display: 'inline-flex',
                        flexShrink: 0,
                        mx,
                        px: 1,
                        py: 0.25,
                        typography: 'caption',
                    }}>
                    {icon}
                    <Typography component="span" variant="caption" sx={{ fontWeight: 500 }}>
                        {pillLabel}
                    </Typography>
                </Stack>
            </Tooltip>
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
