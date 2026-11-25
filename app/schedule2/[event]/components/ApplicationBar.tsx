// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useRef, useState } from 'react';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { AccountMenuButton } from './AccountMenuButton';
import { useScheduleTitle } from './ScheduleTitle';

import { kHeaderBarHeightPx } from '../Constants';

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
 * Outer M3 Expressive pill dock header for the schedule portal. Displays the active page title
 * with a subtle search trigger, morphing in place across the content width minus the circular
 * account button when search is activated.
 */
export function ApplicationBar(props: ApplicationBarProps) {
    const title = useScheduleTitle();
    const inputRef = useRef<HTMLInputElement>(null);

    const [ searchActive, setSearchActive ] = useState<boolean>(false);
    const [ query, setQuery ] = useState<string>('');

    useEffect(() => {
        function handleWindowKeyDown(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
                event.key.toLowerCase() === 'f')
            {
                event.preventDefault();
                setSearchActive(true);
                requestAnimationFrame(() => {
                    inputRef.current?.focus();
                    inputRef.current?.select();
                });
            }
        }

        window.addEventListener('keydown', handleWindowKeyDown);
        return () => window.removeEventListener('keydown', handleWindowKeyDown);
    }, []);

    function handleOpenSearch() {
        setSearchActive(true);
        requestAnimationFrame(() => inputRef.current?.focus());
    }

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
            handleOpenSearch();
        }
    }

    return (
        <HeaderRow>
            <PillDock
                onBlur={handleDockBlur}
                onClick={searchActive ? undefined : handleOpenSearch}
                onKeyDown={searchActive ? undefined : handleDockKeyDown}
                role={searchActive ? 'search' : 'button'}
                searchActive={searchActive}
                tabIndex={searchActive ? undefined : 0}>
                <Fade in={!searchActive}>
                    <DockLayer aria-hidden={searchActive} inert={searchActive}
                               sx={{ pl: 2, pr: 1.5 }}>
                        <Fade key={title} in>
                            <Typography variant="subtitle1" component="div" noWrap
                                        sx={{ flexGrow: 1, minWidth: 0 }}>
                                {title}
                            </Typography>
                        </Fade>
                        <SearchTrigger>
                            <Typography variant="caption"
                                        sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                Search
                            </Typography>
                            <SearchIcon fontSize="small" />
                        </SearchTrigger>
                    </DockLayer>
                </Fade>

                <Fade in={searchActive}>
                    <DockLayer aria-hidden={!searchActive} inert={!searchActive}
                               sx={{ px: 0.75 }}>
                        <DockIconButton aria-label="Close search" onClick={handleCloseSearch}
                                        size="small">
                            <ArrowBackIcon fontSize="small" />
                        </DockIconButton>
                        <SearchInput
                            fullWidth
                            inputProps={{ 'aria-label': 'Search schedule' }}
                            inputRef={inputRef}
                            onChange={event => setQuery(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Escape')
                                    handleCloseSearch();
                            }}
                            placeholder="Search shifts, events, volunteers…"
                            value={query} />
                        <DockIconButton aria-label={query ? 'Clear search' : 'Close search'}
                                        onClick={handleClearOrClose} size="small">
                            <CloseIcon fontSize="small" />
                        </DockIconButton>
                    </DockLayer>
                </Fade>
            </PillDock>

            { props.accountMenu ?? <AccountMenuButton /> }
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
        height: kHeaderBarHeightPx,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
        transition: theme.transitions.create([ 'background-color', 'box-shadow' ], {
            duration: theme.transitions.duration.short,
        }),

        ...theme.applyStyles('dark', {
            boxShadow:
                `0 0 0 1px color-mix(in srgb, ${palette.divider} 65%, transparent)`,
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
 * Overlapping layer inside `<PillDock>` faded in and out via MUI `<Fade>` without layout shift.
 */
const DockLayer = styled(Box)(({ theme }) => ({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
    inset: 0,
    position: 'absolute',
}));

/**
 * Secondary-coloured search affordance on the right edge of the resting dock.
 */
const SearchTrigger = styled('div')(({ theme }) => ({
    alignItems: 'center',
    color: (theme.vars || theme).palette.text.secondary,
    display: 'inline-flex',
    flexShrink: 0,
    gap: theme.spacing(0.75),
}));

/**
 * Secondary-coloured icon button used inside the active search dock.
 */
const DockIconButton = styled(IconButton)(({ theme }) => ({
    color: (theme.vars || theme).palette.text.secondary,
}));

/**
 * Search input with MUI's asymmetric default vertical padding removed so its text baseline matches
 * the resting dock title.
 */
const SearchInput = styled(InputBase)({
    '& .MuiInputBase-input': {
        padding: 0,
    },
});
