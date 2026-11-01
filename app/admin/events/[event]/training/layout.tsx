// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <EventTrainingLayout> is used to configure the accessible tabs within training management.
 */
export default async function EventTrainingLayout(
    props: LayoutProps<'/admin/events/[event]/training'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props, 'event.trainings');
    if (!event.flags.enableTraining)
        notFound();

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: HistoryEduIcon,
                label: 'Assignments',
                url: `/admin/events/${event.slug}/training/assignments`,
            },
            {
                Icon: SettingsSuggestIcon,
                label: 'Settings',
                url: `/admin/events/${event.slug}/training/settings`,
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
