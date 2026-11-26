// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';

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
 * Outer M3 Expressive search pill dock and circular account button for the schedule portal.
 */
export function ApplicationBar(props: ApplicationBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [ query, setQuery ] = useState<string>('');

    useEffect(() => {
        function handleWindowKeyDown(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
                event.key.toLowerCase() === 'f')
            {
                event.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        }

        window.addEventListener('keydown', handleWindowKeyDown);
        return () => window.removeEventListener('keydown', handleWindowKeyDown);
    }, []);

    function handleClear(event: React.MouseEvent) {
        event.stopPropagation();
        setQuery('');
        inputRef.current?.focus();
    }

    return (
        <HeaderRow>
            <SearchDock onClick={() => inputRef.current?.focus()} role="search">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
                <InputBase
                    fullWidth
                    inputProps={{ 'aria-label': 'Search schedule' }}
                    inputRef={inputRef}
                    onChange={event => setQuery(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Escape') {
                            if (query.length > 0)
                                setQuery('');
                            else
                                inputRef.current?.blur();
                        }
                    }}
                    placeholder="Search shifts, events, volunteers…"
                    sx={{ '& .MuiInputBase-input': { p: 0 } }}
                    value={query} />
                { query.length > 0 &&
                    <IconButton aria-label="Clear search" onClick={handleClear} size="small"
                                sx={{ color: 'text.secondary' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton> }
            </SearchDock>

            {props.accountMenu}
        </HeaderRow>
    );
}

/**
 * Outer header row anchored across view transitions. On mobile, sits pinned above the scrolling
 * sheet with `12px` horizontal padding; on desktop, aligns flush with the content sheet edges and
 * scrolls with the page beside the sticky sidebar.
 */
const HeaderRow = styled('header')(({ theme }) => ({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: theme.spacing(1.5),
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
    paddingTop: theme.spacing(1.5),
    viewTransitionName: 'schedule-header',

    [theme.breakpoints.up('md')]: {
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
    },
}));

/**
 * Full-pill M3 Expressive search bar dock.
 */
const SearchDock = styled(Box)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: palette.m3.dock,
        borderRadius: 9999,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        color: palette.text.primary,
        cursor: 'text',
        display: 'flex',
        flex: '1 1 auto',
        gap: theme.spacing(1),
        height: kHeaderBarHeightPx,
        minWidth: 0,
        overflow: 'hidden',
        paddingLeft: theme.spacing(1.75),
        paddingRight: theme.spacing(1),
        transition: theme.transitions.create([ 'background-color', 'box-shadow' ], {
            duration: theme.transitions.duration.short,
        }),

        ...theme.applyStyles('dark', {
            boxShadow:
                `0 0 0 1px color-mix(in srgb, ${palette.divider} 65%, transparent)`,
        }),

        '&:hover': {
            backgroundColor:
                `color-mix(in srgb, ${palette.m3.dock} 95%, ${palette.text.primary})`,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',

            ...theme.applyStyles('dark', {
                backgroundColor:
                    `color-mix(in srgb, ${palette.m3.dock} 92%, ${palette.text.primary})`,
                boxShadow: `0 0 0 1px ${palette.divider}`,
            }),
        },

        '&:focus-within': {
            backgroundColor: palette.m3.dockActive,
        },
    };
});
