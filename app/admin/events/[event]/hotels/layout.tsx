// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HotelIcon from '@mui/icons-material/Hotel';
import PaidIcon from '@mui/icons-material/Paid';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <EventHotelsLayout> is used to configure the accessible tabs within hotel management.
 */
export default async function EventHotelsLayout(props: LayoutProps<'/admin/events/[event]/hotels'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props, 'event.hotels');
    if (!event.flags.enableHotel)
        notFound();

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: HotelIcon,
                label: 'Assignments',
                url: `/admin/events/${event.slug}/hotels/assignments`,
            },
            {
                Icon: PaidIcon,
                label: 'Payments',
                url: `/admin/events/${event.slug}/hotels/payments`,
            },
            {
                Icon: SettingsSuggestIcon,
                label: 'Settings',
                url: `/admin/events/${event.slug}/hotels/settings`,
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
