// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Badge from '@mui/material/Badge';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GroupIcon from '@mui/icons-material/Group';
import HomeIcon from '@mui/icons-material/Home';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';

import type { PublicSchedule } from '@app/api/event/schedule/PublicSchedule';
import { ScheduleContext } from '../ScheduleContext';

/**
 * This component powers the main navigation capability of the volunteer portal, with a user
 * interface optimized for display on mobile devices. A bottom bar navigation will be displayed, in
 * which the active item will be highlighted.
 *
 * https://mui.com/components/bottom-navigation/
 */
export function MobileNavigation() {
    const pathname = usePathname();
    const router = useRouter();

    const { schedule } = useContext(ScheduleContext);
    const scheduleBaseUrl = useMemo(() => `/schedule/${schedule?.slug}`, [ schedule?.slug ]);
    const scheduleNavigationValue = useMemo(() => {
        return pathname.substring(scheduleBaseUrl.length + 1).replace(/\/.*$/, '');

    }, [ pathname, scheduleBaseUrl ]);

    const [ activeEvents, areas, enableKnowledgeBase, hasFavourites, userVolunteer ] = useMemo(() =>
    {
        let activeEvents: number = 0;
        let enableKnowledgeBase: boolean = false;
        let hasFavourites: boolean = false;
        let userVolunteer: PublicSchedule['volunteers'][number] | undefined;

        const areas: { id: string; name: string; }[] = [];
        if (!!schedule) {
            for (const area of Object.values(schedule.program.areas)) {
                activeEvents += area.active;
                areas.push({
                    id: area.id,
                    name: area.name,
                });
            }

            areas.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

            if (!!schedule.favourites)
                hasFavourites = !!Object.keys(schedule.favourites).length;

            enableKnowledgeBase = !!schedule?.config.enableKnowledgeBase;

            if (!!schedule.userId && schedule.volunteers.hasOwnProperty(schedule.userId))
                userVolunteer = schedule.volunteers[schedule.userId];
        }

        return [ activeEvents, areas, enableKnowledgeBase, hasFavourites, userVolunteer ];

    }, [ schedule ]);

    // Compose the activity icons part of the bottom navigation bar. Detail is deliberately lost
    // as the numeric dots take up too much space within the menu.
    const eventsIcon =
        !!activeEvents ? <Badge color="error" variant="dot"><EventNoteIcon /></Badge>
                       : <EventNoteIcon />;

    const shiftsIcon =
        (!!userVolunteer && !!userVolunteer.activeShift)
            ? <Badge color="error" variant="dot"><AccessTimeIcon /></Badge>
            : <AccessTimeIcon />;

    const volunteersIcon =
        !!schedule?.volunteersActive ? <Badge color="error" variant="dot"><GroupIcon /></Badge>
                                     : <GroupIcon />;

    // Anchor elements are used to display the menu through which individual areas in the location
    // can be selected, rather than having a full page for click-through.
    const [ anchorElement, setAnchorElement ] = useState<Element | null>(null);

    // Navigates to the given `areaId`. When the `areaId` is not given, the user will be navigated
    // to the area overview page instead, which lists all the areas that exist.
    const handleAreaNavigation = useCallback((areaId?: string) => {
        if (!!areaId)
            router.push(`${scheduleBaseUrl}/areas/${areaId}`);
        else
            router.push(`${scheduleBaseUrl}/areas`);

        setAnchorElement(null);

    }, [ router, scheduleBaseUrl ]);

    // Called when a navigation is requested to the given `value`. We special case the areas, as
    // an overflow menu with the available areas will be shown instead.
    const handleNavigation = useCallback((event: React.SyntheticEvent, value: string) => {
        switch (value) {
            case 'areas':
                setAnchorElement(event.currentTarget);
                break;
            case 'shifts':
                router.push(`${scheduleBaseUrl}/shifts`);
                break;
            case 'knowledge':
                router.push(`${scheduleBaseUrl}/knowledge`);
                break;
            case 'volunteers':
                router.push(`${scheduleBaseUrl}/volunteers`);
                break;
            default:
                router.push(scheduleBaseUrl);
                break;
        }
    }, [ router, scheduleBaseUrl ]);

    return (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2 }} elevation={3}>
            <BottomNavigation onChange={handleNavigation} value={scheduleNavigationValue}>
                <BottomNavigationAction icon={ <HomeIcon /> } label="Overview" value="" />
                { (hasFavourites || !!userVolunteer) &&
                    <BottomNavigationAction icon={shiftsIcon} label="You" value="shifts" /> }
                <BottomNavigationAction icon={eventsIcon} label="Events" value="areas" />
                { !!enableKnowledgeBase &&
                    <BottomNavigationAction icon={ <InfoOutlinedIcon /> } label="FAQ"
                                            value="knowledge" /> }
                <BottomNavigationAction icon={volunteersIcon} label="Volunteers"
                                        value="volunteers" />
            </BottomNavigation>
            <Menu anchorEl={anchorElement}
                  anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                  MenuListProps={{ sx: { minWidth: '35vw' } }}
                  onClose={ () => setAnchorElement(/* value= */ null) }
                  open={!!anchorElement}>

                { areas.map((area, index) =>
                    <MenuItem key={index} divider={index === areas.length - 1}
                              onClick={ () => handleAreaNavigation(area.id) }
                              selected={ pathname.endsWith(`/areas/${area.id}`) }
                              sx={{ justifyContent: 'center' }}>
                        {area.name}
                    </MenuItem>) }

                <MenuItem onClick={ () => handleAreaNavigation(/* areaId= */ undefined) }
                          selected={ pathname.endsWith('/areas') }
                          sx={{ justifyContent: 'center' }}>Active events</MenuItem>

            </Menu>
        </Paper>
    );
}
