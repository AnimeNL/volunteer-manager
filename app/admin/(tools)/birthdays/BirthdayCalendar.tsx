// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

import { useQueryState, parseAsInteger } from 'nuqs';

import { StandaloneAgendaViewPremium } from '@mui/x-scheduler-premium/agenda-view-premium';
import { StandaloneMonthViewPremium } from '@mui/x-scheduler-premium/month-view-premium';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';

import { ResponsivePaper } from '@app/admin/components/ResponsivePaper';
import { SectionHeader } from '@app/admin/components/SectionHeader';
import { useIsMobile } from '@app/admin/lib/useIsMobile';

/**
 * Props accepted by the <BirthdayCalendar> component.
 */
interface BirthdayCalendarProps {
    /**
     * Filtered representation of birthday information appropriate to share with all clients.
     */
    birthdays: {
        /**
         * Unique ID of the user whose birthday it is.
         */
        id: number;

        /**
         * Full name, or display name when applicable, of this user.
         */
        name: string;

        /**
         * Date on which they celebrate their birthday. The year has been hardcoded to 1998 to avoid
         * unintentionally sharing volunteer ages with a wider group of people.
         */
        birthday: string;

    }[];
}

/**
 * The <BirthdayCalendar> component displays the actual birthday calendar. A regular, month-based
 * view is used for desktop devices, whereas an agenda view is used for mobile devices.
 */
export function BirthdayCalendar(props: BirthdayCalendarProps) {
    const [ mounted, setMounted ] = useState(false);

    const [ month, setMonth ] = useQueryState(
        'month', parseAsInteger.withDefault(new Date().getMonth() + 1));

    useEffect(() => {
        setMounted(true);
    }, []);

    const events = useMemo(() => props.birthdays.map(volunteer => ({
        id: volunteer.id,
        title: volunteer.name,
        allDay: true,
        start: `${volunteer.birthday}T00:00:00`,
        end: `${volunteer.birthday}T00:00:00`,
        rrule: 'FREQ=YEARLY',

    })), [ props.birthdays ]);

    // ---------------------------------------------------------------------------------------------
    // Navigation
    // ---------------------------------------------------------------------------------------------

    const visibleDate = useMemo(() => new Date(new Date().getFullYear(), month - 1, 1), [ month ]);

    const setVisibleDate = useCallback((fn: (prev: Date) => Date) => {
        setMonth(prevMonth => {
            const prevDate = new Date(new Date().getFullYear(), prevMonth - 1, 1);
            const nextDate = fn(prevDate);
            return nextDate.getMonth() + 1;
        });
    }, [ setMonth ]);

    const handlePrevious = useCallback(() => {
        setVisibleDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }, [ setVisibleDate ]);

    const handleNext = useCallback(() => {
        setVisibleDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }, [ setVisibleDate ]);

    const handleToday = useCallback(() => setVisibleDate(() => new Date()), [ setVisibleDate ]);

    // ---------------------------------------------------------------------------------------------

    const isMobile = useIsMobile();

    if (!mounted)
        return null;

    const label = visibleDate.toLocaleString('en-GB', { month: 'long' });

    return (
        <ResponsivePaper sx={{ p: 2, flexGrow: 1, maxHeight: { xs: undefined, md: 760 } }}>
            <Stack direction="column" sx={{ width: '100%', height: '100%' }}>
                <SectionHeader title={label} headerAction={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mr: -1 }}>
                        <IconButton onClick={handlePrevious} size="small">
                            <NavigateBeforeIcon />
                        </IconButton>
                        <Button onClick={handleToday} size="small" variant="outlined"
                                color="inherit">
                            Today
                        </Button>
                        <IconButton onClick={handleNext} size="small">
                            <NavigateNextIcon />
                        </IconButton>
                    </Stack>
                } />
                <Box sx={{ flexGrow: 1, minHeight: 0, mt: 2 }}>
                    { isMobile &&
                        <StandaloneAgendaViewPremium
                            events={events}
                            readOnly
                            visibleDate={visibleDate}
                            onVisibleDateChange={setVisibleDate} /> }
                    { !isMobile &&
                        <StandaloneMonthViewPremium
                            events={events}
                            readOnly
                            visibleDate={visibleDate}
                            onVisibleDateChange={setVisibleDate} /> }
                </Box>
            </Stack>
        </ResponsivePaper>
    );
}
