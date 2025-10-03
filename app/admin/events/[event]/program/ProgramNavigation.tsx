// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import EventNoteIcon from '@mui/icons-material/EventNote';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MapIcon from '@mui/icons-material/Map';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

/**
 * Props accepted by the <ProgramNavigation> component.
 */
interface ProgramNavigationProps {
    /**
     * Slug of the event for which the navigation is being shown.
     */
    slug: string;
}

/**
 * The <ProgramNavigation> component displays a tab-like bar at the top of the Program page, which
 * enables the volunteer to navigate between different sections of the program.
 */
export function ProgramNavigation(props: ProgramNavigationProps) {
    const pathname = usePathname();
    const router = useRouter();

    const navigationOptions = useMemo(() => ([
        {
            label: 'Requests',
            icon: <NewReleasesIcon />,
            url: `/admin/events/${props.slug}/program/requests`
        },
        {
            label: 'Activities',
            icon: <EventNoteIcon />,
            url: `/admin/events/${props.slug}/program/activities`
        },
        {
            label: 'Locations',
            icon: <LocationOnIcon />,
            url: `/admin/events/${props.slug}/program/locations`
        },
        {
            label: 'Areas',
            icon: <MapIcon />,
            url: `/admin/events/${props.slug}/program/areas`
        },
    ]), [ props.slug ]);

    const [ selectedTabIndex, setSelectedTabIndex ] =
        useState<number | undefined>(/* Requests= */ 3);

    useEffect(() => {
        for (let index = 0; index < navigationOptions.length; ++index) {
            if (!pathname.startsWith(navigationOptions[index].url))
                continue;

            setSelectedTabIndex(index);
            break;
        }
    }, [ navigationOptions, pathname ]);

    const handleChange = useCallback((event: unknown, index: number) => {
        if (index < 0 || index > navigationOptions.length)
            return;

        // Note that the `useEffect` above will take care of updating the tab bar.
        router.push(navigationOptions[index].url);

    }, [ navigationOptions, router ]);

    return (
        <Tabs onChange={handleChange} value={selectedTabIndex} variant="fullWidth">
            { navigationOptions.map(({ label, icon }, index) =>
                <Tab key={index} icon={icon} iconPosition="start" label={label} /> )}
        </Tabs>
    );
}
