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
import { styled } from '@mui/material/styles';

/**
 * Spatial order of top-level navigation segments for directional view transitions.
 */
const kSectionOrder = [
    '', '/shifts', '/areas', '/duty-book', '/help-requests', '/knowledge', '/volunteers',
];

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
 * Nested area navigation item inside an expanded sidebar section.
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
        '&.Mui-selected': {
            backgroundColor: `color-mix(in srgb, ${palette.primary.main} 18%, transparent)`,
            color: palette.primary.main,
            '&:hover': {
                backgroundColor: `color-mix(in srgb, ${palette.primary.main} 24%, transparent)`,
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
 * Resolves the relative pathname under `/schedule2/[slug]`.
 */
function getRelativePathname(pathname: string, slug?: string): string {
    const baseUrl = slug ? `/schedule2/${slug}` : '';
    return baseUrl && pathname.startsWith(baseUrl) ? pathname.slice(baseUrl.length) : '';
}

/**
 * Determines directional view-transition types between top-level sidebar sections.
 */
function getTransitionTypes(relativePathname: string, targetSegment: string): string[] | undefined {
    const currentIndex = kSectionOrder.findIndex(segment =>
        segment === '' ? relativePathname === '' : relativePathname.startsWith(segment));
    const targetIndex = kSectionOrder.indexOf(targetSegment);

    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex)
        return undefined;

    return targetIndex > currentIndex ? [ 'nav-forward' ] : [ 'nav-back' ];
}

/**
 * Props accepted by the <OverviewItem> component.
 */
interface OverviewItemProps {
    /**
     * Current pathname relative to `/schedule2/[slug]`, when resolved on the client.
     */
    relativePathname?: string;

    /**
     * Current event slug, when resolved from route params inside `<Suspense>`.
     */
    slug?: string;
}

/**
 * Renders the always-visible Overview entry. Used both as the static `<Suspense>` fallback and for
 * the live route-aware item to prevent layout shift.
 */
function OverviewItem(props: OverviewItemProps) {
    const { relativePathname, slug } = props;

    const isActive = relativePathname === '';
    const icon = isActive
        ? <HomeIcon fontSize="small" />
        : <HomeOutlinedIcon fontSize="small" />;

    if (!slug) {
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
        <NavigationItem component={Link} href={`/schedule2/${slug}`}
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
    const params = useParams<{ slug?: string }>();
    const pathname = usePathname();

    const slug = typeof params.slug === 'string' ? params.slug : undefined;
    const relativePathname = getRelativePathname(pathname, slug);

    return <OverviewItem relativePathname={relativePathname} slug={slug} />;
}

/**
 * Program area summary passed to the desktop sidebar for rendering nested Events entries.
 */
interface NavigationAreaItem {
    activeCount: number;
    id: number;
    name: string;
}

/**
 * Duty Book summary passed to the desktop sidebar for rendering team-scoped Duty Book entries.
 */
interface NavigationDutyBookItem {
    name: string;
    team: string;
    unread: number;
}

/**
 * Props accepted by the <VolunteerNavigationItems> component.
 */
interface VolunteerNavigationItemsProps {
    /**
     * Program areas for the event, rendered as expandable sub-rows under Events.
     */
    areas: NavigationAreaItem[];

    /**
     * Duty Books accessible to the signed-in volunteer, with unread incident counts.
     */
    dutyBooks: NavigationDutyBookItem[];

    /**
     * Whether the signed-in volunteer currently has an active shift.
     */
    hasActiveShift: boolean;

    /**
     * Whether the event has at least one visible Knowledge Base category for this user.
     */
    hasKnowledgeBase: boolean;

    /**
     * Whether the signed-in volunteer has at least one scheduled shift for this event.
     */
    hasShifts: boolean;

    /**
     * Pending help requests summary when the user has access to Help requests.
     */
    helpRequests?: { pending: number };

    /**
     * Event slug for building navigation destinations.
     */
    slug: string;
}

/**
 * Renders volunteer-specific desktop sidebar entries streamed in behind `<Suspense>`.
 */
export function VolunteerNavigationItems(props: VolunteerNavigationItemsProps) {
    const {
        areas, dutyBooks, hasActiveShift, hasKnowledgeBase, hasShifts, helpRequests, slug,
    } = props;

    const pathname = usePathname();
    const relativePathname = getRelativePathname(pathname, slug);

    const [ eventsExpanded, setEventsExpanded ] = useState<boolean>(true);
    const [ dutyBookExpanded, setDutyBookExpanded ] = useState<boolean>(false);

    const handleToggleEvents = useCallback(() => {
        setEventsExpanded(expanded => !expanded);
    }, []);

    const handleToggleDutyBook = useCallback(() => {
        setDutyBookExpanded(expanded => !expanded);
    }, []);

    const isShiftsActive = relativePathname.startsWith('/shifts');
    const isEventsActive = relativePathname === '/areas';
    const isHelpRequestsActive = relativePathname.startsWith('/help-requests');
    const isKnowledgeBaseActive = relativePathname.startsWith('/knowledge');
    const isVolunteersActive = relativePathname.startsWith('/volunteers');
    const totalActiveEvents = areas.reduce((sum, area) => sum + area.activeCount, 0);

    const hasMultipleDutyBooks = dutyBooks.length > 1;
    const totalUnreadDutyBook = dutyBooks.reduce((sum, entry) => sum + entry.unread, 0);
    const isDutyBookActive = hasMultipleDutyBooks
        ? relativePathname === '/duty-book'
        : relativePathname.startsWith('/duty-book');
    const dutyBookHref = hasMultipleDutyBooks
        ? `/schedule2/${slug}/duty-book`
        : dutyBooks.length === 1
            ? `/schedule2/${slug}/duty-book/${dutyBooks[0].team}`
            : '';

    return (
        <>
            { hasShifts &&
                <NavigationItem component={Link} href={`/schedule2/${slug}/shifts`}
                                selected={isShiftsActive}
                                transitionTypes={getTransitionTypes(relativePathname, '/shifts')}>
                    <ListItemIcon>
                        <AccessTimeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Your schedule" />
                    { hasActiveShift &&
                        <ActivityDot aria-label="Active shift" title="Active shift" /> }
                </NavigationItem> }

            <ListItem disablePadding sx={{ mb: 0.5 }}
                      secondaryAction={ areas.length > 0 ? (
                          <ExpandButton
                              aria-expanded={eventsExpanded}
                              aria-label={eventsExpanded ? 'Collapse areas' : 'Expand areas'}
                              edge="end"
                              expanded={eventsExpanded}
                              onClick={handleToggleEvents}
                              size="small">
                              <ExpandMoreIcon fontSize="small" />
                          </ExpandButton>
                      ) : undefined }>
                <NavigationItem component={Link} href={`/schedule2/${slug}/areas`}
                                selected={isEventsActive}
                                sx={areas.length > 0 ? { mb: 0, pr: 5 } : { mb: 0 }}
                                transitionTypes={getTransitionTypes(relativePathname, '/areas')}>
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
                <Collapse in={eventsExpanded} unmountOnExit>
                    <SubMenuList disablePadding>
                        { areas.map(area => {
                            const areaPath = `/areas/${area.id}`;
                            const isAreaActive = relativePathname === areaPath ||
                                relativePathname.startsWith(`${areaPath}/`);

                            return (
                                <SubNavigationItem
                                    key={area.id}
                                    component={Link}
                                    href={`/schedule2/${slug}${areaPath}`}
                                    selected={isAreaActive}
                                    transitionTypes={
                                        getTransitionTypes(relativePathname, '/areas')
                                    }>
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

            { dutyBooks.length > 0 &&
                <>
                    <ListItem disablePadding sx={{ mb: 0.5 }}
                              secondaryAction={ hasMultipleDutyBooks ? (
                                  <ExpandButton
                                      aria-expanded={dutyBookExpanded}
                                      aria-label={
                                          dutyBookExpanded
                                              ? 'Collapse duty books'
                                              : 'Expand duty books'
                                      }
                                      edge="end"
                                      expanded={dutyBookExpanded}
                                      onClick={handleToggleDutyBook}
                                      size="small">
                                      <ExpandMoreIcon fontSize="small" />
                                  </ExpandButton>
                              ) : undefined }>
                        <NavigationItem
                            component={Link}
                            href={dutyBookHref}
                            selected={isDutyBookActive}
                            sx={hasMultipleDutyBooks ? { mb: 0, pr: 5 } : { mb: 0 }}
                            transitionTypes={getTransitionTypes(relativePathname, '/duty-book')}>
                            <ListItemIcon>
                                { isDutyBookActive
                                    ? <BookIcon fontSize="small" />
                                    : <BookOutlinedIcon fontSize="small" /> }
                            </ListItemIcon>
                            <ListItemText primary="Duty book" />
                            { totalUnreadDutyBook > 0 &&
                                <CounterBadge
                                    aria-label={`${totalUnreadDutyBook} unread duty book items`}
                                    tone="urgent">
                                    {totalUnreadDutyBook}
                                </CounterBadge> }
                        </NavigationItem>
                    </ListItem>

                    { hasMultipleDutyBooks &&
                        <Collapse in={dutyBookExpanded} unmountOnExit>
                            <SubMenuList disablePadding>
                                { dutyBooks.map(dutyBook => {
                                    const dutyBookPath = `/duty-book/${dutyBook.team}`;
                                    const isTeamActive = relativePathname === dutyBookPath ||
                                        relativePathname.startsWith(`${dutyBookPath}/`);

                                    return (
                                        <SubNavigationItem
                                            key={dutyBook.team}
                                            component={Link}
                                            href={`/schedule2/${slug}${dutyBookPath}`}
                                            selected={isTeamActive}
                                            transitionTypes={
                                                getTransitionTypes(relativePathname, '/duty-book')
                                            }>
                                            <ListItemText primary={dutyBook.name} />
                                            { dutyBook.unread > 0 &&
                                                <CounterBadge
                                                    aria-label={
                                                        `${dutyBook.unread} unread duty book items`
                                                    }
                                                    tone="urgent">
                                                    {dutyBook.unread}
                                                </CounterBadge> }
                                        </SubNavigationItem>
                                    );
                                }) }
                            </SubMenuList>
                        </Collapse> }
                </> }

            { helpRequests !== undefined &&
                <NavigationItem
                    component={Link}
                    href={`/schedule2/${slug}/help-requests`}
                    selected={isHelpRequestsActive}
                    transitionTypes={getTransitionTypes(relativePathname, '/help-requests')}>
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
                    href={`/schedule2/${slug}/knowledge`}
                    selected={isKnowledgeBaseActive}
                    transitionTypes={getTransitionTypes(relativePathname, '/knowledge')}>
                    <ListItemIcon>
                        { isKnowledgeBaseActive
                            ? <InfoIcon fontSize="small" />
                            : <InfoOutlinedIcon fontSize="small" /> }
                    </ListItemIcon>
                    <ListItemText primary="Knowledge base" />
                </NavigationItem> }

            <NavigationItem
                component={Link}
                href={`/schedule2/${slug}/volunteers`}
                selected={isVolunteersActive}
                transitionTypes={getTransitionTypes(relativePathname, '/volunteers')}>
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
