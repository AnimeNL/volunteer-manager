// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { useScheduleTitle } from './ScheduleTitle';

import { kHeaderBarHeightPx } from '../Constants';

/**
 * Props accepted by the <ApplicationBar> component.
 */
interface ApplicationBarProps {
    /**
     * Account menu button slot streamed behind `<Suspense>` from the Server Component layout so
     * the user's avatar loads without blocking static App Shell prerendering.
     */
    accountMenu: React.ReactNode;
}

/**
 * Outer M3 Expressive pill dock header for the schedule portal. Displays the active page title
 * with a subtle search trigger, morphing in place across the content width minus the circular
 * account button when search is activated.
 */
export function ApplicationBar(props: ApplicationBarProps) {
    const title = useScheduleTitle();
    const inputRef = useRef<HTMLInputElement>(null);

    const [ searchActive, setSearchActive ] = useState<boolean>(false);
    const [ query, setQuery ] = useState<string>('');

    const openSearch = useCallback((select?: boolean) => {
        setSearchActive(true);
        requestAnimationFrame(() => {
            inputRef.current?.focus();
            if (select)
                inputRef.current?.select();
        });
    }, []);

    useEffect(() => {
        function handleWindowKeyDown(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
                event.key.toLowerCase() === 'f')
            {
                event.preventDefault();
                openSearch(/* select= */ true);
            }
        }

        window.addEventListener('keydown', handleWindowKeyDown);
        return () => window.removeEventListener('keydown', handleWindowKeyDown);
    }, [ openSearch ]);

    function handleCloseSearch() {
        setQuery('');
        setSearchActive(false);
    }

    function handleClearOrClose(event: React.MouseEvent) {
        event.stopPropagation();
        if (query.length > 0) {
            setQuery('');
            inputRef.current?.focus();
        } else {
            setSearchActive(false);
        }
    }

    function handleDockBlur(event: React.FocusEvent<HTMLElement>) {
        if (!searchActive)
            return;

        if (event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget))
        {
            return;
        }

        handleCloseSearch();
    }

    function handleDockKeyDown(event: React.KeyboardEvent<HTMLElement>) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openSearch();
        }
    }

    return (
        <HeaderRow>
            <PillDock
                onBlur={handleDockBlur}
                onClick={searchActive ? undefined : () => openSearch()}
                onKeyDown={searchActive ? undefined : handleDockKeyDown}
                role={searchActive ? 'search' : 'button'}
                searchActive={searchActive}
                tabIndex={searchActive ? undefined : 0}>
                { searchActive ? (
                    <>
                        <IconButton aria-label="Close search" onClick={handleCloseSearch}
                                    size="small" sx={{ color: 'text.secondary' }}>
                            <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <InputBase
                            fullWidth
                            inputProps={{ 'aria-label': 'Search schedule' }}
                            inputRef={inputRef}
                            onChange={event => setQuery(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Escape')
                                    handleCloseSearch();
                            }}
                            placeholder="Search shifts, events, volunteers…"
                            sx={{ '& .MuiInputBase-input': { p: 0 } }}
                            value={query} />
                        <IconButton aria-label={query ? 'Clear search' : 'Close search'}
                                    onClick={handleClearOrClose} size="small"
                                    sx={{ color: 'text.secondary' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </>
                ) : (
                    <>
                        <Fade key={title} in>
                            <Typography variant="subtitle1" component="div" noWrap
                                        sx={{ flexGrow: 1, minWidth: 0 }}>
                                {title}
                            </Typography>
                        </Fade>
                        <Stack direction="row" spacing={0.75}
                               sx={{ alignItems: 'center', color: 'text.secondary', flexShrink: 0 }}>
                            <Typography variant="caption"
                                        sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                Search
                            </Typography>
                            <SearchIcon fontSize="small" />
                        </Stack>
                    </>
                ) }
            </PillDock>

            {props.accountMenu}
        </HeaderRow>
    );
}

/**
 * Sticky outer header row anchored across view transitions. On mobile, carries `12px` horizontal
 * padding above the edge-to-edge sheet; on desktop, aligns flush with the content sheet edges.
 */
const HeaderRow = styled('header')(({ theme }) => ({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: theme.spacing(1.5),
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
    paddingTop: theme.spacing(1.5),
    position: 'sticky',
    top: 0,
    viewTransitionName: 'schedule-header',
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
        color: palette.text.primary,
        cursor: 'pointer',
        display: 'flex',
        flex: '1 1 auto',
        gap: theme.spacing(1),
        height: kHeaderBarHeightPx,
        minWidth: 0,
        overflow: 'hidden',
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(1.5),
        transition: theme.transitions.create([ 'background-color', 'box-shadow' ], {
            duration: theme.transitions.duration.short,
        }),

        ...theme.applyStyles('dark', {
            boxShadow:
                `0 0 0 1px color-mix(in srgb, ${palette.divider} 65%, transparent)`,
        }),

        variants: [
            {
                props: { searchActive: false },
                style: {
                    '&:hover': {
                        backgroundColor:
                            `color-mix(in srgb, ${palette.m3.dock} 95%, ${palette.text.primary})`,
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',

                        ...theme.applyStyles('dark', {
                            backgroundColor:
                                `color-mix(in srgb, ${palette.m3.dock} 92%, ` +
                                `${palette.text.primary})`,
                            boxShadow: `0 0 0 1px ${palette.divider}`,
                        }),
                    },
                },
            },
            {
                props: { searchActive: true },
                style: {
                    backgroundColor: palette.m3.dockActive,
                    cursor: 'text',
                    paddingLeft: theme.spacing(0.75),
                    paddingRight: theme.spacing(0.75),
                },
            },
        ],
    };
});
