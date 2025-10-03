// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import Box from '@mui/material/Box';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GroupIcon from '@mui/icons-material/Group';
import HomeIcon from '@mui/icons-material/Home';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NotListedLocationOutlinedIcon from '@mui/icons-material/NotListedLocationOutlined';
import Tooltip from '@mui/material/Tooltip';
import { darken, styled } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import type { PublicSchedule } from '@app/api/event/schedule/PublicSchedule';
import { Alert } from './Alert';
import { ScheduleContext } from '../ScheduleContext';
import { type Temporal, formatDate } from '@lib/Temporal';
import { currentZonedDateTime } from '../CurrentTime';

import { kDesktopMenuWidthPx } from '../Constants';

/**
 * Styling for the <DesktopNavigation> component, particularly to enable the logo-esque image at
 * the top of the item list based on the SVG image.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        paddingLeft: 2,
        paddingRight: 0,
        paddingY: 1,
    },

    header: {
        borderRadius: 1,
        width: `${kDesktopMenuWidthPx - 32}px`,
        height: `${kDesktopMenuWidthPx / 2}px`,
        overflow: 'hidden',
        marginTop: 2,
        marginBottom: .75,
        marginLeft: 2,
    },

    areas: {
        marginLeft: 3,
    },

    item: {
        borderRadius: theme => theme.spacing(1),
        marginBottom: 1,
    },
};

/**
 * Component for displaying a badge with textual content, generally a number.
 */
const NumberBadge = styled(Box)(({ theme }) => ({
    backgroundColor: theme.palette.error.main,
    color: theme.palette.getContrastText(theme.palette.error.main),
    padding: theme.spacing(0.125, 1),
    borderRadius: theme.spacing(1),
    fontSize: theme.spacing(1.5),
    lineHeight: theme.spacing(2.25),
    pointerEvents: 'none',
}));

/**
 * Component for displaying a badge that has no content, other than an indicator.
 */
const SolidBadge = styled(Box)(({ theme }) => ({
    backgroundColor: theme.palette.error.main,
    width: theme.spacing(1),
    height: theme.spacing(1),
    borderRadius: theme.spacing(.5),
    pointerEvents: 'none',
}));

/**
 * The <DesktopNavigationLogo> displays the event's logo svg with a "color" attribute towards the
 * environment's theme colour. This allows different environment to have different logos.
 */
function DesktopNavigationLogo() {
    const theme = useTheme();

    const params = useMemo(() => {
        return new URLSearchParams([
            [ 'color', darken(theme.components?.acThemeLightColor || '#303f9f', 0.3) ],
            [ 'title', /* the empty string= */ '' ],
        ]);
    }, [ theme ]);

    return (
        <Box sx={{ ...kStyles.header, backgroundColor: theme.palette.background.paper }}>
            <object type="image/svg+xml" style={{ marginTop: '-35px' }}
                    data={'/images/logo.svg?' + params} />
        </Box>
    );
}

/**
 * Props accepted by the <DesktopNavigationEntry> component.
 */
interface DesktopNavigationEntryProps {
    /**
     * Whether this is the active navigation item at the moment.
     */
    active?: boolean;

    /**
     * The badge to display as part of this component. Will display a dot when set to `true`, or a
     * larger badge with a number when set to any other accepted value.
     */
    badge?: boolean | number;

    /**
     * URL that should be navigated to when the component has been clicked on.
     */
    href: string;

    /**
     * The icon that should be displayed at the start of this component, if any.
     */
    icon?: React.ReactNode;

    /**
     * The label that indicates what this menu item is meant for.
     */
    label: string;
}

/**
 * Displays a single option in the desktop navigation menu. Stateless beyond the props that it
 * accepts to change the component's display.
 */
function DesktopNavigationEntry(props: DesktopNavigationEntryProps) {
    const { active, badge, href, icon, label } = props;
    return (
        <ListItemButton component={Link} href={href} selected={active} sx={kStyles.item}>

            { !!icon &&
                <ListItemIcon>
                    {icon}
                </ListItemIcon> }

            <ListItemText primaryTypographyProps={{ color: 'text.secondary' }}
                          primary={label} />

            { !!badge && badge === true && <SolidBadge /> }
            { !!badge && typeof badge === 'number' && <NumberBadge>{badge}</NumberBadge> }

        </ListItemButton>
    );
}

/**
 * An alert that updates itself every second while active, displaying the current time the portal
 * understands it to be. Only applicable when the server imposes a time difference on the portal.
 */
function DesktopNavigationTimeAlert() {
    const [ currentTime, setCurrentTime ] =
        useState<Temporal.ZonedDateTime>(currentZonedDateTime());

    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTime(currentZonedDateTime()), 1000);
        return () => clearInterval(intervalId);
    });

    return (
        <Tooltip title="The server has modified the current time in the portal">
            <Alert severity="info" sx={{ ml: 2, px: 2, py: 0, mb: -.25 }} variant="filled">
                { formatDate(currentTime, 'YYYY-MM-DD HH:mm:ss') }
            </Alert>
        </Tooltip>
    );
}

/**
 * This component powers the main navigation capability of the volunteer portal, with a user
 * interface optimized for display on mobile devices. A list that can be shown on the left- or
 * right-hand side of the main content, to make better use of the available screen estate, without
 * polluting it with a full side-drawer.
 */
export function DesktopNavigation() {
    const pathname = usePathname();

    const { schedule } = useContext(ScheduleContext);
    const scheduleBaseUrl = useMemo(() => `/schedule/${schedule?.slug}`, [ schedule?.slug ]);
    const schedulePathname = useMemo(() => {
        return pathname.substring(scheduleBaseUrl.length);

    }, [ pathname, scheduleBaseUrl ]);

    const [ activeEvents, areas, hasFavourites, userVolunteer ] = useMemo(() => {
        let activeEvents: number = 0;
        let hasFavourites: boolean = false;
        let userVolunteer: PublicSchedule['volunteers'][number] | undefined;

        const areas: { name: string; url: string }[] = [];
        if (!!schedule) {
            for (const area of Object.values(schedule.program.areas)) {
                activeEvents += area.active;
                areas.push({
                    name: area.name,
                    url: `${scheduleBaseUrl}/areas/${area.id}`,
                });
            }

            areas.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

            if (!!schedule.favourites)
                hasFavourites = !!Object.keys(schedule.favourites).length;

            if (!!schedule.userId && schedule.volunteers.hasOwnProperty(schedule.userId))
                userVolunteer = schedule.volunteers[schedule.userId];
        }
        return [ activeEvents, areas, hasFavourites, userVolunteer ];

    }, [ schedule, scheduleBaseUrl ]);

    if (!schedule)
        return undefined;

    return (
        <>
            <DesktopNavigationLogo />
            { !!schedule.config.timeOffset && <DesktopNavigationTimeAlert /> }
            <List sx={kStyles.container}>
                <DesktopNavigationEntry active={ schedulePathname === '' }
                                        href={scheduleBaseUrl}
                                        icon={ <HomeIcon /> } label="Overview" />
                { (hasFavourites || !!userVolunteer) &&
                    <DesktopNavigationEntry active={ schedulePathname === '/shifts' }
                                            badge={ !!userVolunteer?.activeShift }
                                            href={ scheduleBaseUrl + '/shifts' }
                                            icon={ <AccessTimeIcon /> } label="Your schedule" /> }
                <DesktopNavigationEntry active={ schedulePathname === '/areas' }
                                        badge={activeEvents}
                                        href={ scheduleBaseUrl + '/areas' }
                                        icon={ <EventNoteIcon /> } label="Events" />
                <List dense sx={kStyles.areas}>
                    { areas.map((area, index) =>
                        <DesktopNavigationEntry key={index} active={ pathname === area.url }
                                                href={area.url}
                                                icon={ <ArrowRightIcon /> } label={area.name} /> )}
                </List>
                { !!schedule.config.enableHelpRequests &&
                    <DesktopNavigationEntry active={ schedulePathname.startsWith('/help-requests') }
                                            badge={ schedule.helpRequestsPending }
                                            href={ scheduleBaseUrl + '/help-requests' }
                                            icon={ <NotListedLocationOutlinedIcon /> }
                                            label="Help requests" /> }
                { (!!schedule.config.enableKnowledgeBase && !!schedule.knowledge.length) &&
                    <DesktopNavigationEntry active={ schedulePathname.startsWith('/knowledge') }
                                            href={ scheduleBaseUrl + '/knowledge' }
                                            icon={ <InfoOutlinedIcon /> }
                                            label="Knowledge base" /> }
                <DesktopNavigationEntry active={ schedulePathname.startsWith('/volunteers') }
                                        badge={ schedule.volunteersActive }
                                        href={ scheduleBaseUrl + '/volunteers' }
                                        icon={ <GroupIcon /> } label="Volunteers" />
            </List>
        </>
    );
}
