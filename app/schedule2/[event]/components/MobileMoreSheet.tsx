// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import BookIcon from '@mui/icons-material/Book';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Drawer from '@mui/material/Drawer';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import IconButton from '@mui/material/IconButton';
import InfoIcon from '@mui/icons-material/Info';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NotListedLocationIcon from '@mui/icons-material/NotListedLocation';
import NotListedLocationOutlinedIcon from '@mui/icons-material/NotListedLocationOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { type Theme, styled } from '@mui/material/styles';

import type { NavigationData, NavigationDutyBook } from '../lib/navigationTypes';
import { CounterBadge } from './NavigationBadges';
import { getNavigationTransitionTypes } from '../lib/navigationTypes';

import { kShellSpacingPx } from '../Constants';

/**
 * Shared M3 tonal secondary-container selected highlight styles for mobile sheet items.
 */
function selectedHighlightStyles(theme: Theme) {
    const palette = (theme.vars || theme).palette;

    return {
        '&.Mui-selected': {
            backgroundColor: palette.m3.secondaryContainer,
            color: palette.m3.onSecondaryContainer,
            '&:hover': {
                backgroundColor: `color-mix(in srgb, ${palette.m3.secondaryContainer} 88%, ${palette.m3.onSecondaryContainer})`,
            },
            '& .MuiListItemIcon-root': {
                color: 'inherit',
            },
            '& .MuiListItemText-primary': {
                fontWeight: 600,
            },
        },
    };
}

/**
 * Full-pill M3 navigation item inside the mobile More bottom sheet.
 */
const SheetNavItem = styled(ListItemButton)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        borderRadius: 9999,
        color: palette.m3.onSurface,
        marginBottom: theme.spacing(0.5),
        minHeight: 44,
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),

        '& .MuiListItemIcon-root': {
            color: palette.m3.onSurfaceVariant,
            minWidth: 36,
        },
        '& .MuiListItemText-root': {
            margin: 0,
            paddingBottom: '2px',
        },
        '& .MuiListItemText-primary': {
            fontSize: '0.875rem',
            fontWeight: 500,
            lineHeight: 1.25,
        },

        ...selectedHighlightStyles(theme),
    };
}) as typeof ListItemButton;

/**
 * Indented sub-menu list with an in-theme vertical guide line matching the desktop sidebar.
 */
const SheetSubMenuList = styled(List)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        borderLeft: `2px solid ${palette.m3.treeLine}`,
        marginBottom: theme.spacing(0.5),
        marginLeft: 25,
        paddingBottom: 0,
        paddingLeft: 12,
        paddingTop: 0,
    };
});

/**
 * Nested navigation item inside an expanded mobile sheet section.
 */
const SheetSubNavItem = styled(ListItemButton)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        borderRadius: 9999,
        color: palette.m3.onSurfaceVariant,
        marginBottom: theme.spacing(0.25),
        minHeight: 38,
        paddingLeft: theme.spacing(1.5),
        paddingRight: theme.spacing(1.5),

        '& .MuiListItemText-root': {
            margin: 0,
            paddingBottom: '2px',
        },
        '& .MuiListItemText-primary': {
            fontSize: '0.8125rem',
            fontWeight: 400,
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },

        ...selectedHighlightStyles(theme),
    };
}) as typeof ListItemButton;

/**
 * Rotating chevron button for expanding or collapsing nested sheet sections.
 */
const ExpandButton = styled(IconButton, {
    shouldForwardProp: prop => prop !== 'expanded',
})<{ expanded: boolean }>(({ theme }) => ({
    color: 'inherit',
    marginLeft: theme.spacing(0.5),
    opacity: 0.7,
    padding: theme.spacing(0.5),
    transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
    }),

    variants: [
        {
            props: { expanded: true },
            style: {
                transform: 'rotate(180deg)',
            },
        },
    ],
}));

/**
 * Expandable Duty book section synced with the desktop sidebar (direct link for a single team,
 * collapsible per-team list when multiple teams are accessible).
 */
function MobileDutyBookSection(props: {
    dutyBooks: NavigationDutyBook[];
    eventSlug: string;
    onClose: () => void;
    relativePathname: string;
}) {
    const { dutyBooks, eventSlug, onClose, relativePathname } = props;
    const [ expanded, setExpanded ] = useState<boolean>(false);
    const handleToggle = useCallback(() => setExpanded(open => !open), []);

    if (!dutyBooks.length)
        return null;

    const hasMultiple = dutyBooks.length > 1;
    const totalUnread = dutyBooks.reduce((sum, entry) => sum + entry.unread, 0);
    const isActive = hasMultiple
        ? relativePathname === '/duty-book'
        : relativePathname.startsWith('/duty-book');
    const href = hasMultiple
        ? `/schedule2/${eventSlug}/duty-book`
        : `/schedule2/${eventSlug}/duty-book/${dutyBooks[0].team}`;
    const transitionTypes = getNavigationTransitionTypes(relativePathname, '/duty-book');

    return (
        <>
            <ListItem disablePadding sx={{ mb: 0.5 }}
                      secondaryAction={ hasMultiple ? (
                          <ExpandButton
                              aria-expanded={expanded}
                              aria-label={expanded ? 'Collapse duty books' : 'Expand duty books'}
                              edge="end"
                              expanded={expanded}
                              onClick={handleToggle}
                              size="small">
                              <ExpandMoreIcon fontSize="small" />
                          </ExpandButton>
                      ) : undefined }>
                <SheetNavItem component={Link} href={href} onClick={onClose} selected={isActive}
                              sx={hasMultiple ? { mb: 0, pr: 5 } : { mb: 0 }}
                              transitionTypes={transitionTypes}>
                    <ListItemIcon>
                        { isActive
                            ? <BookIcon fontSize="small" />
                            : <BookOutlinedIcon fontSize="small" /> }
                    </ListItemIcon>
                    <ListItemText primary="Duty book" />
                    { totalUnread > 0 &&
                        <CounterBadge aria-label={`${totalUnread} unread duty book items`}
                                      tone="urgent">
                            {totalUnread}
                        </CounterBadge> }
                </SheetNavItem>
            </ListItem>

            { hasMultiple &&
                <Collapse in={expanded} unmountOnExit>
                    <SheetSubMenuList disablePadding>
                        { dutyBooks.map(dutyBook => {
                            const dutyBookPath = `/duty-book/${dutyBook.team}`;
                            const isTeamActive = relativePathname === dutyBookPath ||
                                relativePathname.startsWith(`${dutyBookPath}/`);

                            return (
                                <SheetSubNavItem key={dutyBook.team} component={Link}
                                                 href={`/schedule2/${eventSlug}${dutyBookPath}`}
                                                 onClick={onClose}
                                                 selected={isTeamActive}
                                                 transitionTypes={transitionTypes}>
                                    <ListItemText primary={dutyBook.name} />
                                    { dutyBook.unread > 0 &&
                                        <CounterBadge
                                            aria-label={`${dutyBook.unread} unread duty book items`}
                                            tone="urgent">
                                            {dutyBook.unread}
                                        </CounterBadge> }
                                </SheetSubNavItem>
                            );
                        }) }
                    </SheetSubMenuList>
                </Collapse> }
        </>
    );
}

/**
 * Props accepted by the <MobileMoreSheet> component.
 */
interface MobileMoreSheetProps {
    /**
     * Streamed volunteer navigation data, when authenticated.
     */
    data?: NavigationData;

    /**
     * Called when the bottom sheet should close.
     */
    onClose: () => void;

    /**
     * Whether the bottom sheet is currently open.
     */
    open: boolean;

    /**
     * Current pathname relative to `/schedule2/[event]`.
     */
    relativePathname: string;
}

/**
 * Bottom drawer surfaced from the "More" tab in the mobile floating pill bar, hosting secondary
 * schedule routes synced with the desktop sidebar (Duty book, Help requests, Knowledge base,
 * Volunteers, and Settings).
 */
export function MobileMoreSheet(props: MobileMoreSheetProps) {
    const { data, onClose, open, relativePathname } = props;
    if (!data)
        return null;

    const { dutyBooks, eventSlug, hasKnowledgeBase, hasSettings, helpRequests } = data;

    const isHelpRequestsActive = relativePathname.startsWith('/help-requests');
    const isKnowledgeBaseActive = relativePathname.startsWith('/knowledge');
    const isVolunteersActive = relativePathname.startsWith('/volunteers');
    const isSettingsActive = relativePathname.startsWith('/settings');

    return (
        <Drawer anchor="bottom" onClose={onClose} open={open}>
            <Box sx={{
                padding: `${kShellSpacingPx}px`,
                paddingBottom: `calc(${kShellSpacingPx}px + env(safe-area-inset-bottom, 0px))`,
            }}>
                <Box sx={{
                    bgcolor: 'divider',
                    borderRadius: 9999,
                    height: 4,
                    marginX: 'auto',
                    mb: 1.5,
                    width: 36,
                }} />

                <List disablePadding>
                    <MobileDutyBookSection
                        dutyBooks={dutyBooks}
                        eventSlug={eventSlug}
                        onClose={onClose}
                        relativePathname={relativePathname} />

                    { helpRequests !== undefined &&
                        <SheetNavItem
                            component={Link}
                            href={`/schedule2/${eventSlug}/help-requests`}
                            onClick={onClose}
                            selected={isHelpRequestsActive}
                            transitionTypes={
                                getNavigationTransitionTypes(relativePathname, '/help-requests')
                            }>
                            <ListItemIcon>
                                { isHelpRequestsActive
                                    ? <NotListedLocationIcon fontSize="small" />
                                    : <NotListedLocationOutlinedIcon fontSize="small" /> }
                            </ListItemIcon>
                            <ListItemText primary="Help requests" />
                            { helpRequests.pending > 0 &&
                                <CounterBadge
                                    aria-label={`${helpRequests.pending} pending help requests`}
                                    tone="urgent">
                                    {helpRequests.pending}
                                </CounterBadge> }
                        </SheetNavItem> }

                    { hasKnowledgeBase &&
                        <SheetNavItem
                            component={Link}
                            href={`/schedule2/${eventSlug}/knowledge`}
                            onClick={onClose}
                            selected={isKnowledgeBaseActive}
                            transitionTypes={
                                getNavigationTransitionTypes(relativePathname, '/knowledge')
                            }>
                            <ListItemIcon>
                                { isKnowledgeBaseActive
                                    ? <InfoIcon fontSize="small" />
                                    : <InfoOutlinedIcon fontSize="small" /> }
                            </ListItemIcon>
                            <ListItemText primary="Knowledge base" />
                        </SheetNavItem> }

                    <SheetNavItem
                        component={Link}
                        href={`/schedule2/${eventSlug}/volunteers`}
                        onClick={onClose}
                        selected={isVolunteersActive}
                        transitionTypes={
                            getNavigationTransitionTypes(relativePathname, '/volunteers')
                        }>
                        <ListItemIcon>
                            { isVolunteersActive
                                ? <GroupIcon fontSize="small" />
                                : <GroupOutlinedIcon fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText primary="Volunteers" />
                    </SheetNavItem>

                    { hasSettings &&
                        <SheetNavItem
                            component={Link}
                            href={`/schedule2/${eventSlug}/settings`}
                            onClick={onClose}
                            selected={isSettingsActive}
                            transitionTypes={
                                getNavigationTransitionTypes(relativePathname, '/settings')
                            }>
                            <ListItemIcon>
                                { isSettingsActive
                                    ? <SettingsIcon fontSize="small" />
                                    : <SettingsOutlinedIcon fontSize="small" /> }
                            </ListItemIcon>
                            <ListItemText primary="Settings" />
                        </SheetNavItem> }
                </List>
            </Box>
        </Drawer>
    );
}
