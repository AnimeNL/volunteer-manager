// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Diversity1Icon from '@mui/icons-material/Diversity1';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationContextWithEvent } from '../requireAuthenticationContextWithEvent';

/**
 * The <EventTicketsLayout> provides the necessary context for tabs to work across these pages.
 */
export default async function EventTicketsLayout(
    props: LayoutProps<'/admin/events/[event]/tickets'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props);

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: LocalActivityOutlinedIcon,
                label: 'Volunteers',
                url: `/admin/events/${event.slug}/tickets/volunteers`,
                urlMatchMode: 'prefix',
            },
            {
                Icon: Diversity1Icon,
                label: 'Externals',
                url: `/admin/events/${event.slug}/tickets/externals`,
                urlMatchMode: 'prefix',
            },
            {
                Icon: SettingsOutlinedIcon,
                label: 'Settings',
                url: `/admin/events/${event.slug}/tickets/settings`,
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
