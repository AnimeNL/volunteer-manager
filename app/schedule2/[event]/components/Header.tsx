// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { kCardBorderRadiusPx } from '../Constants';

/**
 * Props accepted by the <Header> component.
 */
interface HeaderProps {
    /**
     * Optional right-aligned header actions, typically a series of MUI `<IconButton>` elements.
     * May be wrapped in `<Suspense>` for dynamically loaded actions without shifting the header.
     */
    actions?: React.ReactNode;

    /**
     * Optional single-line description displayed beneath the title. May be wrapped in `<Suspense>`
     * (with a text `<Skeleton>` fallback) without causing vertical layout shift.
     */
    description?: React.ReactNode;

    /**
     * Leading icon rendered inside the tonal squircle badge. May be wrapped in `<Suspense>`
     * without changing the fixed badge dimensions.
     */
    icon: React.ReactNode;

    /**
     * Primary page heading. May be wrapped in `<Suspense>` (with a text `<Skeleton>` fallback)
     * without causing vertical layout shift.
     */
    title: React.ReactNode;
}

/**
 * Shared Material Design 3 page header for the schedule portal. Sits directly on the outer shell
 * above the content sheet on mobile and renders as a tonal banner card inside the sheet on
 * desktop, with fixed-metric slots so any prop can stream behind `<Suspense>` without layout shift.
 */
export function Header(props: HeaderProps) {
    return (
        <Stack component="section" direction="row" spacing={1.75} sx={{
            alignItems: 'center',
            background: {
                md:
                    'linear-gradient(135deg, var(--mui-palette-m3-secondaryContainer) 0%, ' +
                    'var(--mui-palette-m3-card) 135%)',
            },
            borderRadius: { md: `${kCardBorderRadiusPx}px` },
            px: { xs: 1.5, md: 2 },
            py: { xs: 0.5, md: 1.75 },
        }}>
            <Avatar aria-hidden="true" variant="rounded" sx={{
                bgcolor: {
                    xs: 'm3.secondaryContainer',
                    md: 'color-mix(in srgb, var(--mui-palette-m3-sheet) 38%, transparent)',
                },
                borderRadius: `${kCardBorderRadiusPx}px`,
                color: 'text.primary',
                height: 44,
                width: 44,
            }}>
                {props.icon}
            </Avatar>
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                <Typography component="h1" variant="h6" noWrap sx={{ lineHeight: 1.3 }}>
                    {props.title}
                </Typography>
                { !!props.description &&
                    <Typography component="div" variant="body2" color="textSecondary" noWrap>
                        {props.description}
                    </Typography> }
            </Box>
            { !!props.actions &&
                <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexShrink: 0 }}>
                    {props.actions}
                </Stack> }
        </Stack>
    );
}
