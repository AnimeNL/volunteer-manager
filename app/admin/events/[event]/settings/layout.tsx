// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import GroupsIcon from '@mui/icons-material/Groups';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationContextWithEvent } from '../requireAuthenticationContextWithEvent';

/**
 * The <EventSettingsLayout> is used to configure the accessible tabs within event settings.
 */
export default async function EventSettingsLayout(
    props: LayoutProps<'/admin/events/[event]/settings'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'system.internals.ai',
    });

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: SettingsSuggestIcon,
                label: 'Configuration',
                url: `/admin/events/${event.slug}/settings/configuration`,
            },
            {
                Icon: EditCalendarIcon,
                label: 'Deadlines',
                url: `/admin/events/${event.slug}/settings/deadlines`,
            },
            {
                Icon: GroupsIcon,
                label: 'Teams',
                url: `/admin/events/${event.slug}/settings/teams`,
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
