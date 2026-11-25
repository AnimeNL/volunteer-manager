// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { Suspense, useCallback, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BookIcon from '@mui/icons-material/Book';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import Collapse from '@mui/material/Collapse';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import HomeIcon from '@mui/icons-material/Home';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
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
import { type Theme, styled } from '@mui/material/styles';

import type { NavigationArea, NavigationData, NavigationDutyBook } from '../lib/navigationTypes';
import { getNavigationTransitionTypes, getRelativeNavigationPath } from '../lib/navigationTypes';

/**
 * Shared tonal primary selected highlight styles for top-level and nested sidebar items.
 */
function selectedHighlightStyles(theme: Theme) {
    const palette = (theme.vars || theme).palette;

    return {
        '&.Mui-selected': {
            backgroundColor: `color-mix(in srgb, ${palette.primary.main} 18%, transparent)`,
            color: palette.primary.main,
            '&:hover': {
                backgroundColor: `color-mix(in srgb, ${palette.primary.main} 24%, transparent)`,
            },
            '& .MuiListItemIcon-root': {
                color: 'inherit',
            },
            '& .MuiListItemText-primary': {
                fontWeight: 600,
            },
        },

        ...theme.applyStyles('dark', {
            '&.Mui-selected': {
                backgroundColor: `color-mix(in srgb, ${palette.primary.main} 28%, transparent)`,
                color: palette.primary.light,
                '&:hover': {
                    backgroundColor: `color-mix(in srgb, ${palette.primary.main} 34%, transparent)`,
                },
            },
        }),
    };
}

/**
 * Material Design 3 rounded navigation item shared across all desktop sidebar entries, matching the
 * theme's card border radius with a tonal primary active container.
 */
const NavigationItem = styled(ListItemButton)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        borderRadius: theme.shape.borderRadius,
        color: palette.text.primary,
        marginBottom: theme.spacing(0.5),
        minHeight: 44,
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(1.5),
        transition: theme.transitions.create([ 'background-color', 'color' ], {
            duration: theme.transitions.duration.shortest,
        }),

        '& .MuiListItemIcon-root': {
            color: palette.text.secondary,
            minWidth: 36,
        },
        '& .MuiListItemText-primary': {
            fontSize: theme.typography.body2.fontSize,
            fontWeight: 500,
        },

        ...selectedHighlightStyles(theme),
    };
}) as typeof ListItemButton;

/**
 * Indented sub-menu list with a faint in-theme vertical guide line aligned under the parent icon.
 */
const SubMenuList = styled(List)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        borderLeft: `2px solid color-mix(in srgb, ${palette.primary.main} 22%, transparent)`,
        marginBottom: theme.spacing(0.5),
        marginLeft: 25,
        paddingBottom: 0,
        paddingLeft: 13,
        paddingTop: 0,

        ...theme.applyStyles('dark', {
            borderLeftColor: `color-mix(in srgb, ${palette.primary.main} 30%, transparent)`,
        }),
    };
});

/**
 * Nested navigation item inside an expanded sidebar section.
 */
const SubNavigationItem = styled(ListItemButton)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        borderRadius: theme.shape.borderRadius,
        color: palette.text.secondary,
        marginBottom: theme.spacing(0.25),
        minHeight: 36,
        paddingBottom: theme.spacing(0.5),
        paddingLeft: theme.spacing(1.5),
        paddingRight: theme.spacing(1.5),
        paddingTop: theme.spacing(0.5),
        transition: theme.transitions.create([ 'background-color', 'color' ], {
            duration: theme.transitions.duration.shortest,
        }),

        '& .MuiListItemText-primary': {
            fontSize: '0.8125rem',
            fontWeight: 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },

        ...selectedHighlightStyles(theme),
    };
}) as typeof ListItemButton;

/**
 * Green activity indicator dot displayed when the signed-in volunteer has a currently active shift.
 */
const ActivityDot = styled('span')(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.success.main,
        borderRadius: '50%',
        boxShadow: `0 0 0 3px color-mix(in srgb, ${palette.success.main} 25%, transparent)`,
        flexShrink: 0,
        height: 8,
        width: 8,
    };
});

/**
 * Pill counter badge supporting subtle (active events) and urgent (unread duty book / help
 * requests) tones.
 */
const CounterBadge = styled('span', {
    shouldForwardProp: prop => prop !== 'tone',
})<{ tone?: 'subtle' | 'urgent' }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: `color-mix(in srgb, ${palette.text.primary} 10%, transparent)`,
        borderRadius: 9999,
        color: palette.text.secondary,
        display: 'inline-flex',
        flexShrink: 0,
        fontSize: '0.6875rem',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 600,
        height: 20,
        justifyContent: 'center',
        lineHeight: 1,
        minWidth: 20,
        paddingLeft: theme.spacing(0.75),
        paddingRight: theme.spacing(0.75),

        variants: [
            {
                props: { tone: 'urgent' },
                style: {
                    backgroundColor: palette.error.main,
                    color: palette.error.contrastText,
                },
            },
        ],
    };
});

/**
 * Rotating chevron button for expanding or collapsing nested sidebar sections.
 */
const ExpandButton = styled(IconButton, {
    shouldForwardProp: prop => prop !== 'expanded',
})<{ expanded: boolean }>(({ theme }) => ({
    color: 'inherit',
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(-0.5),
    opacity: 0.7,
    padding: theme.spacing(0.25),
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
 * Renders the always-visible Overview entry. Used both as the static `<Suspense>` fallback and for
 * the live route-aware item to prevent layout shift.
 */
function OverviewItem(props: { eventSlug?: string; relativePathname?: string }) {
    const { eventSlug, relativePathname } = props;

    const isActive = relativePathname === '';
    const icon = isActive
        ? <HomeIcon fontSize="small" />
        : <HomeOutlinedIcon fontSize="small" />;

    if (!eventSlug) {
        return (
            <NavigationItem selected={isActive}>
                <ListItemIcon>
                    {icon}
                </ListItemIcon>
                <ListItemText primary="Overview" />
            </NavigationItem>
        );
    }

    return (
        <NavigationItem component={Link} href={`/schedule2/${eventSlug}`}
                        selected={isActive}
                        transitionTypes={relativePathname ? [ 'nav-back' ] : undefined}>
            <ListItemIcon>
                {icon}
            </ListItemIcon>
            <ListItemText primary="Overview" />
        </NavigationItem>
    );
}

/**
 * Leaf client component reading dynamic route params and pathname for the Overview item.
 */
function RouteAwareOverviewItem() {
    const params = useParams<{ event?: string }>();
    const pathname = usePathname();

    const eventSlug = typeof params.event === 'string' ? params.event : undefined;
    const relativePathname = getRelativeNavigationPath(pathname, eventSlug);

    return <OverviewItem eventSlug={eventSlug} relativePathname={relativePathname} />;
}

/**
 * Expandable Events section with per-area rows (expanded by default) and subtle active counters.
 */
function EventsSection(props: {
    areas: NavigationArea[];
    eventSlug: string;
    relativePathname: string;
}) {
    const { areas, eventSlug, relativePathname } = props;
    const [ expanded, setExpanded ] = useState<boolean>(true);
    const handleToggle = useCallback(() => setExpanded(open => !open), []);

    const isEventsActive = relativePathname === '/areas';
    const totalActiveEvents = areas.reduce((sum, area) => sum + area.activeCount, 0);
    const transitionTypes = getNavigationTransitionTypes(relativePathname, '/areas');

    return (
        <>
            <ListItem disablePadding sx={{ mb: 0.5 }}
                      secondaryAction={ areas.length > 0 ? (
                          <ExpandButton
                              aria-expanded={expanded}
                              aria-label={expanded ? 'Collapse areas' : 'Expand areas'}
                              edge="end"
                              expanded={expanded}
                              onClick={handleToggle}
                              size="small">
                              <ExpandMoreIcon fontSize="small" />
                          </ExpandButton>
                      ) : undefined }>
                <NavigationItem component={Link} href={`/schedule2/${eventSlug}/areas`}
                                selected={isEventsActive}
                                sx={areas.length > 0 ? { mb: 0, pr: 5 } : { mb: 0 }}
                                transitionTypes={transitionTypes}>
                    <ListItemIcon>
                        { isEventsActive
                            ? <EventNoteIcon fontSize="small" />
                            : <EventNoteOutlinedIcon fontSize="small" /> }
                    </ListItemIcon>
                    <ListItemText primary="Events" />
                    { totalActiveEvents > 0 &&
                        <CounterBadge aria-label={`${totalActiveEvents} active events`}>
                            {totalActiveEvents}
                        </CounterBadge> }
                </NavigationItem>
            </ListItem>

            { areas.length > 0 &&
                <Collapse in={expanded} unmountOnExit>
                    <SubMenuList disablePadding>
                        { areas.map(area => {
                            const areaPath = `/areas/${area.id}`;
                            const isAreaActive = relativePathname === areaPath ||
                                relativePathname.startsWith(`${areaPath}/`);

                            return (
                                <SubNavigationItem key={area.id} component={Link}
                                                   href={`/schedule2/${eventSlug}${areaPath}`}
                                                   selected={isAreaActive}
                                                   transitionTypes={transitionTypes}>
                                    <ListItemText primary={area.name} />
                                    { area.activeCount > 0 &&
                                        <CounterBadge
                                            aria-label={`${area.activeCount} active events`}>
                                            {area.activeCount}
                                        </CounterBadge> }
                                </SubNavigationItem>
                            );
                        }) }
                    </SubMenuList>
                </Collapse> }
        </>
    );
}

/**
 * Expandable Duty book section (collapsed by default) with urgent unread counters.
 */
function DutyBookSection(props: {
    dutyBooks: NavigationDutyBook[];
    eventSlug: string;
    relativePathname: string;
}) {
    const { dutyBooks, eventSlug, relativePathname } = props;
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
                <NavigationItem component={Link} href={href} selected={isActive}
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
                </NavigationItem>
            </ListItem>

            { hasMultiple &&
                <Collapse in={expanded} unmountOnExit>
                    <SubMenuList disablePadding>
                        { dutyBooks.map(dutyBook => {
                            const dutyBookPath = `/duty-book/${dutyBook.team}`;
                            const isTeamActive = relativePathname === dutyBookPath ||
                                relativePathname.startsWith(`${dutyBookPath}/`);

                            return (
                                <SubNavigationItem key={dutyBook.team} component={Link}
                                                   href={`/schedule2/${eventSlug}${dutyBookPath}`}
                                                   selected={isTeamActive}
                                                   transitionTypes={transitionTypes}>
                                    <ListItemText primary={dutyBook.name} />
                                    { dutyBook.unread > 0 &&
                                        <CounterBadge
                                            aria-label={`${dutyBook.unread} unread duty book items`}
                                            tone="urgent">
                                            {dutyBook.unread}
                                        </CounterBadge> }
                                </SubNavigationItem>
                            );
                        }) }
                    </SubMenuList>
                </Collapse> }
        </>
    );
}

/**
 * Renders volunteer-specific desktop sidebar entries streamed in behind `<Suspense>`.
 */
export function VolunteerNavigationItems(props: { data: NavigationData }) {
    const {
        areas, dutyBooks, eventSlug, hasActiveShift, hasKnowledgeBase, hasShifts, helpRequests,
    } = props.data;

    const pathname = usePathname();
    const relativePathname = getRelativeNavigationPath(pathname, eventSlug);

    const isShiftsActive = relativePathname.startsWith('/shifts');
    const isHelpRequestsActive = relativePathname.startsWith('/help-requests');
    const isKnowledgeBaseActive = relativePathname.startsWith('/knowledge');
    const isVolunteersActive = relativePathname.startsWith('/volunteers');

    return (
        <>
            { hasShifts &&
                <NavigationItem
                    component={Link}
                    href={`/schedule2/${eventSlug}/shifts`}
                    selected={isShiftsActive}
                    transitionTypes={getNavigationTransitionTypes(relativePathname, '/shifts')}>
                    <ListItemIcon>
                        <AccessTimeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Your schedule" />
                    { hasActiveShift &&
                        <ActivityDot aria-label="Active shift" title="Active shift" /> }
                </NavigationItem> }

            <EventsSection areas={areas} eventSlug={eventSlug}
                           relativePathname={relativePathname} />

            <DutyBookSection dutyBooks={dutyBooks} eventSlug={eventSlug}
                             relativePathname={relativePathname} />

            { helpRequests !== undefined &&
                <NavigationItem
                    component={Link}
                    href={`/schedule2/${eventSlug}/help-requests`}
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
                </NavigationItem> }

            { hasKnowledgeBase &&
                <NavigationItem
                    component={Link}
                    href={`/schedule2/${eventSlug}/knowledge`}
                    selected={isKnowledgeBaseActive}
                    transitionTypes={getNavigationTransitionTypes(relativePathname, '/knowledge')}>
                    <ListItemIcon>
                        { isKnowledgeBaseActive
                            ? <InfoIcon fontSize="small" />
                            : <InfoOutlinedIcon fontSize="small" /> }
                    </ListItemIcon>
                    <ListItemText primary="Knowledge base" />
                </NavigationItem> }

            <NavigationItem
                component={Link}
                href={`/schedule2/${eventSlug}/volunteers`}
                selected={isVolunteersActive}
                transitionTypes={getNavigationTransitionTypes(relativePathname, '/volunteers')}>
                <ListItemIcon>
                    { isVolunteersActive
                        ? <GroupIcon fontSize="small" />
                        : <GroupOutlinedIcon fontSize="small" /> }
                </ListItemIcon>
                <ListItemText primary="Volunteers" />
            </NavigationItem>
        </>
    );
}

/**
 * Route-aware desktop sidebar list. Renders Overview immediately in the static App Shell, and
 * accepts streamed volunteer-specific items via `children`.
 */
export function DesktopNavigationList(props: React.PropsWithChildren) {
    return (
        <List sx={{ paddingLeft: 1.5, paddingRight: 0, paddingY: 1 }}>
            <Suspense fallback={ <OverviewItem /> }>
                <RouteAwareOverviewItem />
            </Suspense>
            {props.children}
        </List>
    );
}
