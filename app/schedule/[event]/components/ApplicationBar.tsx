// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AppBar from '@mui/material/AppBar';
import Divider from '@mui/material/Divider';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LogoutIcon from '@mui/icons-material/Logout';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SearchIcon from '@mui/icons-material/Search';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { alpha, styled } from '@mui/material/styles';

import { DarkModeMenuItem } from './DarkModeMenuItem';
import { ScheduleContext } from '../ScheduleContext';
import { SearchResults } from './SearchResults';
import { callApi } from '@lib/callApi';
import { useTitle } from '../ScheduleTitle';

import { kDesktopMaximumWidthPx, kDesktopMenuWidthPx, kEnforceSingleLine } from '../Constants';

/**
 * Containing element for the search field. Provides relative positioning, and a hover effect on
 * desktop to illustrate that interaction with this element is possible.
 * Based on https://mui.com/material-ui/react-app-bar/ (MIT)
 */
const Search = styled('div')(({ theme }) => ({
    position: 'relative',
    marginLeft: theme.spacing(1),
    width: 'auto',
}));

/**
 * Containing element for the search icon, which should be visible both in the element's default
 * state, as well as in the expanded state where user input is accepted.
 * Based on https://mui.com/material-ui/react-app-bar/ (MIT)
 */
const SearchIconWrapper = styled('div')(({ theme }) => ({
    pointerEvents: 'none',
    position: 'absolute',

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',

    height: '100%',
    padding: theme.spacing(0, 2),
}));

/**
 * Input element through which the user can initiate a search. Accepts user input, and expands over
 * the width of the parent <AppBar> when input is actually being accepted.
 * Based on https://mui.com/material-ui/react-app-bar/ (MIT)
 */
const StyledInputBase = styled(InputBase)(({ theme }) => ({
    color: 'inherit',

    '& .MuiInputBase-input': {
        borderRadius: theme.shape.borderRadius,
        boxSizing: 'border-box',
        cursor: 'pointer',
        padding: theme.spacing(2, 0),
        paddingLeft: `calc(1em + ${theme.spacing(4)})`,
        transition: theme.transitions.create('width'),
        width: theme.spacing(6),

        '&:focus, &[value]:not([value=""])': {
            backgroundColor: alpha(theme.palette.common.white, 0.2),
            cursor: 'text',

            // There's an additional 16 spacing of emptiness in the header: 2 on either side, 2
            // between each of the three elements (4x2=8), and an additional 8 for the search box.
            width: `calc(100vw - ${theme.spacing(16)})`,
        },

        '&:focus:hover': {
            backgroundColor: alpha(theme.palette.common.white, 0.25),
        }
    },

    [theme.breakpoints.up('md')]: {
        '& .MuiInputBase-input': {
            '&:focus, &[value]:not([value=""])': {
                width: '50vw',
            },
        },
    }
}));

/**
 * Styling rules for the <ApplicationBar> component & hierarchy.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        display: 'block',
    },

    title: {
        ...kEnforceSingleLine,
        flexGrow: 1,
    },

    toolbar: {
        margin: 'auto',

        paddingLeft: {
            md: `${kDesktopMenuWidthPx}px`,
        },

        maxWidth: {
            md: `${kDesktopMaximumWidthPx}px`,
        },
    },
}

/**
 * Types of HTML element types that are used by MUI to take user input in the search functionality.
 */
type MUIInputElement = HTMLTextAreaElement | HTMLInputElement;

/**
 * The <ApplicationBar> component is the title bar of our application. It provides the user with a
 * visual cue on where they are, allows them to search through all available information, and has
 * a menu that allows access to account settings and, potentially, other settings.
 */
export function ApplicationBar() {
    const router = useRouter();
    const title = useTitle();

    const { schedule } = useContext(ScheduleContext);
    const searchBarRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        function interceptSearchKey(event: KeyboardEvent): void {
            if (!searchBarRef.current)
                return;

            if (!event.ctrlKey || event.keyCode !== /* f= */ 70)
                return;

            event.preventDefault();
            searchBarRef.current.focus();
        }

        window.addEventListener('keydown', interceptSearchKey);
        return () => window.removeEventListener('keydown', interceptSearchKey);
    });

    // ---------------------------------------------------------------------------------------------
    // Search functionality
    // ---------------------------------------------------------------------------------------------

    const [ searchBarAnchor, setSearchBarAnchor ] = useState<any>(null);
    const [ searchBarClearFocus, setSearchBarClearFocus ] = useState<boolean>(false);
    const [ searchBarRequestCommit, setSearchBarRequestCommit ] = useState<boolean>(false);
    const [ searchQuery, setSearchQuery ] = useState<string>('');

    const closeSearchResults = useCallback(() => {
        setSearchQuery(/* no query= */ '');
        setSearchBarClearFocus(true);
        setSearchBarRequestCommit(false);
    }, [ /* no dependencies */ ]);

    // Called when the value of the search bar has changed. Until the search is committed (through
    // the enter key), search results will appear anchored to the search bar.
    const handleSearchChange = useCallback((event: React.ChangeEvent<MUIInputElement>) => {
        if (searchBarAnchor !== event.target)
            setSearchBarAnchor(event.target);

        setSearchQuery(event.target.value);

    }, [ searchBarAnchor ]);

    // Called when the user releases a key. The <Enter> and <Escape> keys have special behaviour,
    // as they respectively commit the search (i.e. navigate) and close the search results.
    const handleSearchKeyUp = useCallback((event: React.KeyboardEvent<MUIInputElement>) => {
        switch (event.key) {
            case 'Enter':
                setSearchBarRequestCommit(true);
                break;

            case 'Escape':
                closeSearchResults();
                break;
        }
    }, [ closeSearchResults ]);

    // Clears focus from the search bar programmatically. Deliberately done in an effect as opposed
    // to real time, to avoid UI jank by doing too many things at the same time.
    useEffect(() => {
        if (searchBarClearFocus) {
            if (document.activeElement instanceof HTMLElement)
                document.activeElement.blur();

            setSearchBarClearFocus(false);
        }
    }, [ searchBarClearFocus ]);

    // ---------------------------------------------------------------------------------------------
    // User menu functionality
    // ---------------------------------------------------------------------------------------------

    const [ userMenuAnchor, setUserMenuAnchor ] = useState<any>(null);
    const [ userMenuOpen, setUserMenuOpen ] = useState(false);

    // Callbacks to open and/or close the user menu.
    const closeUserMenu = useCallback(() => setUserMenuOpen(false), [ /* no dependencies */ ]);
    const openUserMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        setUserMenuAnchor(event.currentTarget);
        setUserMenuOpen(true);
    }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    const navigateToFeedback = useCallback(() => {
        if (!schedule || !schedule.slug)
            return;  // the portal has not finished loading yet

        setUserMenuOpen(false);
        router.push(`/schedule/${schedule.slug}/feedback`);

    }, [ router, schedule ]);

    // Signs the user out of their account, and forwards them back to the home page since the
    // schedule app is only available to signed in and participating volunteers.
    const handleSignOut = useCallback(async () => {
        const response = await callApi('post', '/api/auth/sign-out', { /* no params */ });
        if (response.success)
            router.push(response.returnUrl ?? '/');

    }, [ router ]);

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <AppBar position="sticky" sx={kStyles.container}>
                <Toolbar sx={kStyles.toolbar}>
                    <Typography variant="h6" component="div" sx={kStyles.title}
                                suppressHydrationWarning>
                        {title}
                    </Typography>
                    <Search>
                        <SearchIconWrapper>
                            <SearchIcon />
                        </SearchIconWrapper>
                        <StyledInputBase placeholder="Search..."
                                         inputProps={{ 'aria-label': 'search' }}
                                         inputRef={searchBarRef}
                                         onChange={handleSearchChange}
                                         onKeyUp={handleSearchKeyUp}
                                         value={searchQuery} />
                    </Search>
                    <IconButton onClick={openUserMenu} size="large" color="inherit">
                        <AccountCircle />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <SearchResults anchorEl={searchBarAnchor} commit={searchBarRequestCommit}
                           onClose={closeSearchResults} query={searchQuery} />

            <Menu anchorEl={userMenuAnchor}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  onClose={closeUserMenu}
                  open={userMenuOpen}>

                <DarkModeMenuItem />

                <MenuItem onClick={navigateToFeedback}>
                    <ListItemIcon>
                        <FeedbackOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        Feedback…
                    </ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleSignOut}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        Sign out
                    </ListItemText>
                </MenuItem>

            </Menu>
        </>
    );
}
