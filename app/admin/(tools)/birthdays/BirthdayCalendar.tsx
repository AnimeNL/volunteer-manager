// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { StandaloneAgendaViewPremium } from '@mui/x-scheduler-premium/agenda-view-premium';
import { StandaloneMonthViewPremium } from '@mui/x-scheduler-premium/month-view-premium';

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
    const events = useMemo(() => props.birthdays.map(volunteer => ({
        id: volunteer.id,
        title: volunteer.name,
        allDay: true,
        start: `${volunteer.birthday}T00:00:00`,
        end: `${volunteer.birthday}T00:00:00`,
        rrule: 'FREQ=YEARLY',

    })), [ props.birthdays ]);

    const isMobile = useIsMobile();
    return isMobile ? <StandaloneAgendaViewPremium events={events} readOnly />
                    : <StandaloneMonthViewPremium events={events} readOnly />;
}
