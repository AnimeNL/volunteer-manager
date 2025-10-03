// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import { useCallback, useContext } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import SecurityIcon from '@mui/icons-material/Security';

import { ScheduleContext } from '../ScheduleContext';
import { type VendorTeam, kVendorTeam } from '@lib/database/Types';
import { concatenateNames } from '../lib/concatenateNames';

/**
 * Header to use for the vendor card, depending on the team.
 */
const kVendorCardHeader: { [k in VendorTeam]: string } = {
    [kVendorTeam.FirstAid]: 'First Aid team',
    [kVendorTeam.Security]: 'Security team',
};

/**
 * Icons to show on the the vendor cards, which depends on the team the card is representing.
 */
const kVendorCardIcon: { [k in VendorTeam]: React.ReactNode } = {
    [kVendorTeam.FirstAid]: <LocalHospitalIcon color="primary" />,
    [kVendorTeam.Security]: <SecurityIcon color="primary" />,
};

/**
 * Lazily import the calendar popover, as it's not something that most people require.
 */
const LazyCalendarPopover = dynamic(() => import('./CalendarPopover'), { ssr: false });

/**
 * Props accepted by the <OverviewVendorCard> component.
 */
interface OverviewVendorCardProps {
    /**
     * The vendor team for whom this card should be displayed.
     */
    team: VendorTeam;
}

/**
 * The <OverviewVendorCard> component displays an overview card for one of the vendor teams. All on-
 * site personnel will be shown on the card, whereas seniors can click through to a full calendar
 * view displaying the team's full schedule.
 */
export function OverviewVendorCard(props: OverviewVendorCardProps) {
    const { schedule } = useContext(ScheduleContext);

    const pathName = usePathname();

    const router = useRouter();
    const searchParams = useSearchParams();

    // Name of the search parameter that will determine whether the schedule is opened. This is done
    // using a search parameter rather than state to make sure that navigation works intuitively.
    const searchParamName = `${props.team}-schedule`;

    const handleCloseCalendar = useCallback(() => router.push(pathName), [ pathName, router ]);
    const handleOpenCalendar = useCallback(() => {
        router.push(`${pathName}?${searchParamName}=1`);
    }, [ pathName, router, searchParamName ]);

    if (!schedule || !schedule.vendors[props.team])
        return undefined;  // this team does not exist

    const vendor = schedule.vendors[props.team]!;
    if (!vendor.active.length && !vendor.schedule.length)
        return undefined;  // this team has no representation

    const title = kVendorCardHeader[props.team];
    const subheader = !!vendor.active.length ? `${concatenateNames(vendor.active)} on location`
                                             : 'No personnel is currently on location';

    if (!vendor.schedule.length) {
        return (
            <Card>
                <CardHeader avatar={ kVendorCardIcon[props.team] }
                            title={title} titleTypographyProps={{ variant: 'subtitle2' }}
                            subheader={subheader} />
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardActionArea onClick={handleOpenCalendar}
                                sx={{ '& .MuiCardHeader-action': { alignSelf: 'center',
                                                                   pr: 1, pt: 0.5 } }}>

                    <CardHeader action={ <ReadMoreIcon color="disabled" /> }
                                avatar={ kVendorCardIcon[props.team] }
                                title={title} titleTypographyProps={{ variant: 'subtitle2' }}
                                subheader={subheader} />

                </CardActionArea>
            </Card>
            <LazyCalendarPopover open={searchParams.has(searchParamName)} title={title}
                                 onClose={handleCloseCalendar} schedule={vendor.schedule} />
        </>
    );
}
