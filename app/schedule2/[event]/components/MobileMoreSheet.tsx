// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import BookIcon from '@mui/icons-material/Book';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import GroupIcon from '@mui/icons-material/Group';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import InfoIcon from '@mui/icons-material/Info';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NotListedLocationIcon from '@mui/icons-material/NotListedLocation';
import NotListedLocationOutlinedIcon from '@mui/icons-material/NotListedLocationOutlined';
import { styled } from '@mui/material/styles';

import type { NavigationData } from '../lib/navigationTypes';
import { CounterBadge } from './NavigationBadges';
import { getNavigationTransitionTypes } from '../lib/navigationTypes';

import { kCardBorderRadiusPx, kShellSpacingPx } from '../Constants';

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
        '& .MuiListItemText-primary': {
            fontSize: '0.875rem',
            fontWeight: 500,
        },
        '&.Mui-selected': {
            backgroundColor: palette.m3.secondaryContainer,
            color: palette.m3.onSecondaryContainer,
            '& .MuiListItemIcon-root': {
                color: 'inherit',
            },
            '& .MuiListItemText-primary': {
                fontWeight: 600,
            },
        },
    };
}) as typeof ListItemButton;

/**
 * Props accepted by the <MobileMoreSheet> component.
 */
interface MobileMoreSheetProps {
    /**
     * Streamed volunteer navigation data, when authenticated.
     */
    data?: NavigationData;

    /**
     * Event identity banner URL displayed at the top of the sheet.
     */
    eventBannerUrl?: string;

    /**
     * Event display name for the banner alt attribute.
     */
    eventName?: string;

    /**
     * Active event slug for constructing route links.
     */
    eventSlug?: string;

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
 * schedule routes (Duty book, Help requests, Knowledge base, Volunteers) with their live badges.
 */
export function MobileMoreSheet(props: MobileMoreSheetProps) {
    const { data, eventBannerUrl, eventName, eventSlug, onClose, open, relativePathname } = props;

    const slug = data?.eventSlug ?? eventSlug;
    if (!slug)
        return null;

    const dutyBooks = data?.dutyBooks ?? [];
    const totalUnreadDutyBooks = dutyBooks.reduce((sum, entry) => sum + entry.unread, 0);
    const dutyBookHref = dutyBooks.length === 1
        ? `/schedule2/${slug}/duty-book/${dutyBooks[0].team}`
        : `/schedule2/${slug}/duty-book`;

    const isDutyBookActive = relativePathname.startsWith('/duty-book');
    const isHelpRequestsActive = relativePathname.startsWith('/help-requests');
    const isKnowledgeBaseActive = relativePathname.startsWith('/knowledge');
    const isVolunteersActive = relativePathname.startsWith('/volunteers');

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

                { eventBannerUrl &&
                    <Box component="img" alt={eventName ?? 'AnimeCon'} src={eventBannerUrl} sx={{
                        borderRadius: `${kCardBorderRadiusPx}px`,
                        display: 'block',
                        height: 84,
                        mb: 1.5,
                        objectFit: 'cover',
                        width: '100%',
                    }} /> }

                <List disablePadding>
                    { dutyBooks.length > 0 &&
                        <SheetNavItem
                            component={Link}
                            href={dutyBookHref}
                            onClick={onClose}
                            selected={isDutyBookActive}
                            transitionTypes={getNavigationTransitionTypes(relativePathname, '/duty-book')}>
                            <ListItemIcon>
                                { isDutyBookActive
                                    ? <BookIcon fontSize="small" />
                                    : <BookOutlinedIcon fontSize="small" /> }
                            </ListItemIcon>
                            <ListItemText primary="Duty book" />
                            { totalUnreadDutyBooks > 0 &&
                                <CounterBadge
                                    aria-label={`${totalUnreadDutyBooks} unread duty book items`}
                                    tone="urgent">
                                    {totalUnreadDutyBooks}
                                </CounterBadge> }
                        </SheetNavItem> }

                    { data?.helpRequests !== undefined &&
                        <SheetNavItem
                            component={Link}
                            href={`/schedule2/${slug}/help-requests`}
                            onClick={onClose}
                            selected={isHelpRequestsActive}
                            transitionTypes={getNavigationTransitionTypes(relativePathname, '/help-requests')}>
                            <ListItemIcon>
                                { isHelpRequestsActive
                                    ? <NotListedLocationIcon fontSize="small" />
                                    : <NotListedLocationOutlinedIcon fontSize="small" /> }
                            </ListItemIcon>
                            <ListItemText primary="Help requests" />
                            { data.helpRequests.pending > 0 &&
                                <CounterBadge
                                    aria-label={`${data.helpRequests.pending} pending help requests`}
                                    tone="urgent">
                                    {data.helpRequests.pending}
                                </CounterBadge> }
                        </SheetNavItem> }

                    { data?.hasKnowledgeBase &&
                        <SheetNavItem
                            component={Link}
                            href={`/schedule2/${slug}/knowledge`}
                            onClick={onClose}
                            selected={isKnowledgeBaseActive}
                            transitionTypes={getNavigationTransitionTypes(relativePathname, '/knowledge')}>
                            <ListItemIcon>
                                { isKnowledgeBaseActive
                                    ? <InfoIcon fontSize="small" />
                                    : <InfoOutlinedIcon fontSize="small" /> }
                            </ListItemIcon>
                            <ListItemText primary="Knowledge base" />
                        </SheetNavItem> }

                    <SheetNavItem
                        component={Link}
                        href={`/schedule2/${slug}/volunteers`}
                        onClick={onClose}
                        selected={isVolunteersActive}
                        transitionTypes={getNavigationTransitionTypes(relativePathname, '/volunteers')}>
                        <ListItemIcon>
                            { isVolunteersActive
                                ? <GroupIcon fontSize="small" />
                                : <GroupOutlinedIcon fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText primary="Volunteers" />
                    </SheetNavItem>
                </List>
            </Box>
        </Drawer>
    );
}
