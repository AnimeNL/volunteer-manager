// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import EventNoteIcon from '@mui/icons-material/EventNote';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PersonIcon from '@mui/icons-material/Person';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { NavigationMenu } from '../../../layout/NavigationMenu';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import type { NavigationTopLevelItem } from '@app/admin/layout/NavigationItem';

/**
 * This variant of the parallel route composes the menu for a particular event, including the teams
 * that are participating in that event. Rich, real-time information is conveyed.
 */
export default async function EventMenu(props: LayoutProps<'/admin/events/[event]'>) {
    const { event } = await props.params;

    const { access, user } = await requireAuthenticationContext({ check: 'admin-event', event });

    // TODO: Badge for "settings" when dates have not been published yet

    const items: NavigationTopLevelItem[] = [
        {
            Icon: DashboardOutlinedIcon,
            badge: { severity: 'warning', value: true },  // migration in progress
            label: 'Dashboard',
            url: `/admin/events/${event}`,
            urlMatchMode: 'strict',
        },
        {
            Icon: AnalyticsOutlinedIcon,
            badge: { severity: 'error', value: true },  // migration not started
            // TODO: Condition on availability
            label: 'Finances',
            permission: {
                permission: 'statistics.finances',
            },
            url: `/admin/events/${event}/finance`,
        },
        {
            Icon: HotelIcon,
            badge: { severity: 'error', value: true },  // migration not started
            // TODO: Condition on availability
            label: 'Hotels',
            permission: {
                permission: 'event.hotels',
                scope: { event },
            },
            url: `/admin/events/${event}/hotels`,
        },
        {
            Icon: EventNoteIcon,
            badge: { severity: 'error', value: true },  // migration not started
            // TODO: Condition on availability
            label: 'Program',
            url: `/admin/events/${event}/program`,
        },
        {
            Icon: MonetizationOnIcon,
            badge: { severity: 'error', value: true },  // migration not started
            // TODO: Condition on availability
            label: 'Refunds',
            permission: {
                permission: 'event.refunds',
                scope: { event },
            },
            url: `/admin/events/${event}/refunds`,
        },
        {
            Icon: HistoryEduIcon,
            badge: { severity: 'error', value: true },  // migration not started
            // TODO: Condition on availability
            label: 'Trainings',
            permission: {
                permission: 'event.trainings',
                scope: { event },
            },
            url: `/admin/events/${event}/training`,
        },
        {
            Icon: SettingsOutlinedIcon,
            badge: { severity: 'error', value: true },  // migration not started
            label: 'Settings',
            permission: {
                permission: 'event.settings',
                scope: { event },
            },
            url: `/admin/events/${event}/settings`,
        },
    ];

    items.push({
        color: '#5d4037',
        header: 'Crew',
        id: '2026-crew',
        items: [
            // TODO: Applications
            // TODO: Duty book
            // TODO: First aid
            // TODO: Knowledge base
            // TODO: Retention
            // TODO: Schedule
            // TODO: Security
            // TODO: Shifts
            {
                Icon: PersonIcon,
                badge: { severity: 'warning', value: true },  // migration in progress
                label: 'Volunteers',
                permission: {
                    permission: 'event.volunteers.information',
                    operation: 'read',
                    scope: {
                        event,
                        team: 'crew',
                    },
                },
                url: `/admin/events/${event}/crew/volunteers`,
            },
            // TODO: Website
        ],
    });

    items.push({
        color: '#303f9f',
        header: 'Stewards',
        id: '2026-stewards',
        items: [
            // TODO: Applications
            // TODO: Duty book
            // TODO: First aid
            // TODO: Knowledge base
            // TODO: Retention
            // TODO: Schedule
            // TODO: Security
            // TODO: Shifts
            {
                Icon: PersonIcon,
                badge: { severity: 'warning', value: true },  // migration in progress
                label: 'Volunteers',
                permission: {
                    permission: 'event.volunteers.information',
                    operation: 'read',
                    scope: {
                        event,
                        team: 'stewards',
                    },
                },
                url: `/admin/events/${event}/stewards/volunteers`,
            },
            // TODO: Website
        ],
    });

    return (
        <NavigationMenu access={access} id="events" title={`AnimeCon ${event}`} items={items}
                        userId={user.id} />
    );
}
