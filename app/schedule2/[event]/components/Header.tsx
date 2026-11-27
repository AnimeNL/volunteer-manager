// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { IconBadge } from './IconBadge';
import { SuspenseReveal } from './Page';

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
 * above the content sheet on mobile and renders frameless at the top of the sheet on desktop, with
 * fixed-metric slots so any prop can stream behind `<Suspense>` without layout shift.
 */
export function Header(props: HeaderProps) {
    return (
        <Stack component="section" direction="row" spacing={1.75} sx={{
            alignItems: 'center',
            borderBottom: { md: 1 },
            borderColor: { md: 'divider' },
            flexShrink: 0,
            px: { xs: 1.5, md: 0 },
            pt: { xs: 0.5, md: 0 },
            pb: { xs: 0.5, md: 1.5 },
        }}>
            <IconBadge size="lg">{props.icon}</IconBadge>
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                <Typography component="h1" variant="h6" noWrap>
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

/**
 * Server Component leaf awaiting an async header slot resolver inside `<SuspenseReveal>`.
 */
async function AsyncHeaderValue(props: { resolve: () => Promise<React.ReactNode> }) {
    return await props.resolve();
}

/**
 * Streams an async `<Header>` slot (such as `icon` or `actions`) behind `<SuspenseReveal>`.
 */
export function HeaderAsyncSlot(props: {
    fallback?: React.ReactNode;
    resolve: () => Promise<React.ReactNode>;
}) {
    return (
        <SuspenseReveal fallback={props.fallback ?? null}>
            <AsyncHeaderValue resolve={props.resolve} />
        </SuspenseReveal>
    );
}

/**
 * Streams an async text `<Header>` slot (`title` or `description`) with a `<Skeleton>` fallback.
 */
export function HeaderTextSlot(props: {
    resolve: () => Promise<React.ReactNode>;
    width: number;
}) {
    return (
        <HeaderAsyncSlot
            fallback={ <Skeleton variant="text" width={props.width} /> }
            resolve={props.resolve} />
    );
}
