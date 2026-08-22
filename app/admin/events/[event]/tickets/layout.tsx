// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Diversity1Icon from '@mui/icons-material/Diversity1';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import PublicIcon from '@mui/icons-material/Public';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <EventTicketsLayout> provides the necessary context for tabs to work across these pages.
 */
export default async function EventTicketsLayout(
    props: LayoutProps<'/admin/events/[event]/tickets'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props, {
        permission: 'volunteers.tickets',
        operation: 'read',
    });

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
                label: 'Associates',
                url: `/admin/events/${event.slug}/tickets/associates`,
                urlMatchMode: 'prefix',
            },
            {
                Icon: PublicIcon,
                label: 'Visitors',
                url: `/admin/events/${event.slug}/tickets/visitors`,
                urlMatchMode: 'prefix',
                permission: {
                    permission: 'event.tickets',  // note: different from volunteers.tickets
                    operation: 'read',
                    scope: { event: event.slug },
                },
            }
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
