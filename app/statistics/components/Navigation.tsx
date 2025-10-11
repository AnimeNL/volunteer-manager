// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import EventIcon from '@mui/icons-material/Event';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { Temporal, formatDuration } from '@lib/Temporal';

/**
 * Props accepted by the <StatisticsLayout> component.
 */
export interface NavigationProps {
    /**
     * Events, if any, for which sales information is available to the volunteer.
     */
    enableSales: {
        /**
         * Human-presentable name of the event.
         */
        name: string;

        /**
         * Unique slug identifying the event.
         */
        slug: string;
    }[];

    // TODO: enableVolunteers <events>

    /**
     * Most recent time at which sales information was updated, as a Temporal.ZonedDateTime
     * compatible string representation.
     */
    recentSalesUpdate?: string;
}

/**
 * The <Navigation> component provides the navigation bar specific to the statistics sub-app, which
 * enables the signed in volunteer to navigate between different dashboards. It is a client-side
 * proposal as we'll want it to reflect which dashboard is currently visible.
 */
export function Navigation(props: NavigationProps) {
    const pathname = usePathname();

    const [ salesAnchorEl, setSalesAnchorEl ] = useState<HTMLElement | null>(null);

    const closeSalesMenu = useCallback(() => setSalesAnchorEl(null), [ /* no dependencies */ ]);
    const openSalesMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        setSalesAnchorEl(event.currentTarget);
    }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    const shouldDisplayUpdateTime = useMediaQuery(theme => theme.breakpoints.up('md'));

    const updateTime = useMemo(() => {
        let updateTime: Temporal.ZonedDateTime | undefined;
        if (shouldDisplayUpdateTime) {
            if (pathname.startsWith('/statistics/sales') && !!props.recentSalesUpdate)
                updateTime = Temporal.ZonedDateTime.from(props.recentSalesUpdate);
        }

        if (!updateTime)
            return undefined;

        const currentTime = Temporal.Now.zonedDateTimeISO();
        const difference = updateTime.since(currentTime);

        return formatDuration(difference);

    }, [ pathname, props.recentSalesUpdate, shouldDisplayUpdateTime ]);

    // ---------------------------------------------------------------------------------------------

    const dashboardColor = pathname === '/statistics' ? 'primary' : 'inherit';
    const salesColor = pathname.startsWith('/statistics/sales') ? 'primary' : 'inherit';

    return (
        <Stack direction="row" divider= { <Divider orientation="vertical" flexItem /> }
               alignItems="center" spacing={2}>
            <Button LinkComponent={Link} href="/statistics" color={dashboardColor}>
                Dashboard
            </Button>
            { props.enableSales.length > 0 &&
                <>
                    <Button endIcon={ <ExpandMoreIcon /> } onClick={openSalesMenu}
                            color={salesColor}>
                        Sales
                    </Button>
                    <Menu open={!!salesAnchorEl} anchorEl={salesAnchorEl} onClose={closeSalesMenu}
                          slotProps={{ list: { dense: true } }} disableScrollLock>
                        { props.enableSales.map(({ name, slug }) => (
                            <MenuItem key={slug} component="a" LinkComponent={Link}
                                      href={`/statistics/sales/${slug}`}>
                                <EventIcon fontSize="small" color="inherit" sx={{ mr: 1.5 }} />
                                {name}
                            </MenuItem>
                        )) }
                    </Menu>
                </> }
            { /* TODO: Volunteers */ }
            { !!updateTime &&
                <Typography color="textDisabled" sx={{ marginLeft: 'auto !important' }}>
                    updated {updateTime}
                </Typography> }
        </Stack>
    );
}
