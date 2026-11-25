// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useRef, useState } from 'react';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { AccountMenuButton } from './AccountMenuButton';
import { AnimatedTitle } from './AnimatedTitle';
import { useScheduleTitle } from './ScheduleTitle';

import { kHeaderBarHeightPx, kShellSpacingPx } from '../Constants';

/**
 * Sticky outer header row anchored across view transitions. On mobile, carries `12px` horizontal
 * padding above the edge-to-edge sheet; on desktop, aligns flush with the content sheet edges.
 */
const HeaderRow = styled('header')(({ theme }) => ({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: kShellSpacingPx,
    paddingLeft: kShellSpacingPx,
    paddingRight: kShellSpacingPx,
    paddingTop: kShellSpacingPx,
    position: 'sticky',
    top: 0,
    viewTransitionName: 'schedule2-header',
    zIndex: theme.zIndex.appBar,

    [theme.breakpoints.up('md')]: {
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
    },
}));

/**
 * Full-pill M3 Expressive outer title/search dock that morphs in place with zero layout shift.
 */
const PillDock = styled(Box, {
    shouldForwardProp: prop => prop !== 'searchActive',
})<{ searchActive: boolean }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: palette.m3.dock,
        borderRadius: 9999,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        color: palette.m3.onSurface,
        cursor: 'pointer',
        display: 'flex',
        flex: '1 1 auto',
        height: kHeaderBarHeightPx,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
        transition: theme.transitions.create([ 'background-color', 'box-shadow' ], {
            duration: 200,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
        }),

        ...theme.applyStyles('dark', {
            boxShadow: `0 0 0 1px color-mix(in srgb, ${palette.m3.outlineVariant} 65%, transparent)`,
        }),

        variants: [
            {
                props: { searchActive: true },
                style: {
                    backgroundColor: palette.m3.dockActive,
                    cursor: 'text',
                },
            },
        ],
    };
});

/**
 * Overlapping layer inside `<PillDock>` enabling a smooth horizontal crossfade between the
 * resting title bar and active search input without layout shift.
 */
const DockLayer = styled(Box, {
    shouldForwardProp: prop => prop !== 'active' && prop !== 'slideFrom',
})<{ active: boolean; slideFrom: 'left' | 'right' }>(({ theme }) => ({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
    inset: 0,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    transition: theme.transitions.create([ 'opacity', 'transform' ], {
        duration: 180,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
    }),

    '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
    },

    variants: [
        {
            props: { active: false, slideFrom: 'left' },
            style: {
                transform: 'translateX(-8px)',
                '@media (prefers-reduced-motion: reduce)': {
                    transform: 'none',
                },
            },
        },
        {
            props: { active: false, slideFrom: 'right' },
            style: {
                transform: 'translateX(8px)',
                '@media (prefers-reduced-motion: reduce)': {
                    transform: 'none',
                },
            },
        },
        {
            props: { active: true },
            style: {
                opacity: 1,
                pointerEvents: 'auto',
                transform: 'translateX(0)',
            },
        },
    ],
}));

/**
 * Props accepted by the <ApplicationBar> component.
 */
interface ApplicationBarProps {
    /**
     * Optional account menu button slot streamed behind `<Suspense>` from the Server Component
     * layout so the user's avatar loads without blocking static App Shell prerendering.
     */
    accountMenu?: React.ReactNode;
}

/**
 * Outer M3 Expressive pill dock header for `app/schedule2/`. Displays the active page title with a
 * subtle search trigger, morphing in place across the content width minus the circular account
 * button when search is activated.
 */
export function ApplicationBar(props: ApplicationBarProps) {
    const title = useScheduleTitle();
    const inputRef = useRef<HTMLInputElement>(null);

    const [ searchActive, setSearchActive ] = useState<boolean>(false);
    const [ query, setQuery ] = useState<string>('');

    const handleOpenSearch = useCallback(() => {
        setSearchActive(true);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, []);

    const handleCloseSearch = useCallback(() => {
        setQuery('');
        setSearchActive(false);
    }, []);

    const handleClearOrClose = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        if (query.length > 0) {
            setQuery('');
            inputRef.current?.focus();
        } else {
            setSearchActive(false);
        }
    }, [ query.length ]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape')
            handleCloseSearch();
    }, [ handleCloseSearch ]);

    const handleDockBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
        if (!searchActive)
            return;

        if (event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget))
        {
            return;
        }

        handleCloseSearch();
    }, [ handleCloseSearch, searchActive ]);

    return (
        <HeaderRow>
            <PillDock
                onBlur={handleDockBlur}
                onClick={searchActive ? undefined : handleOpenSearch}
                role={searchActive ? 'search' : 'button'}
                searchActive={searchActive}
                tabIndex={searchActive ? undefined : 0}
                onKeyDown={searchActive ? undefined : event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOpenSearch();
                    }
                }}>
                <DockLayer active={!searchActive} aria-hidden={searchActive}
                           inert={searchActive} slideFrom="left"
                           sx={{ pl: 2, pr: 1.5 }}>
                    <AnimatedTitle title={title} />
                    <Box sx={{
                        alignItems: 'center',
                        color: 'text.secondary',
                        display: 'inline-flex',
                        flexShrink: 0,
                        gap: 0.75,
                    }}>
                        <Typography variant="caption"
                                    sx={{ display: { xs: 'none', sm: 'inline' }, fontWeight: 500 }}>
                            Search
                        </Typography>
                        <SearchIcon fontSize="small" />
                    </Box>
                </DockLayer>

                <DockLayer active={searchActive} aria-hidden={!searchActive}
                           inert={!searchActive} slideFrom="right"
                           sx={{ px: 0.75 }}>
                    <IconButton aria-label="Close search" onClick={handleCloseSearch}
                                size="small" sx={{ color: 'text.secondary' }}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <InputBase
                        fullWidth
                        inputProps={{ 'aria-label': 'Search schedule' }}
                        inputRef={inputRef}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search shifts, events, volunteers…"
                        sx={{ fontSize: '0.875rem' }}
                        value={query} />
                    <IconButton aria-label={query ? 'Clear search' : 'Close search'}
                                onClick={handleClearOrClose} size="small"
                                sx={{ color: 'text.secondary' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </DockLayer>
            </PillDock>

            { props.accountMenu ?? <AccountMenuButton /> }
        </HeaderRow>
    );
}
