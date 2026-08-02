// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import FeedOutlinedIcon from '@mui/icons-material/FeedOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationContextWithEventAndTeam }
    from '../../requireAuthenticationContextWithEventAndTeam';

/**
 * The <EventTeamWebsiteLayout> is used to configure the accessible tabs.
 */
export default async function EventTeamWebsiteLayout(
    props: LayoutProps<'/admin/events/[event]/[team]/website'>)
{
    const { access, event, team } = await requireAuthenticationContextWithEventAndTeam(props);
    if (!team.flags.managesContent)
        notFound();

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: FeedOutlinedIcon,
                label: 'Content',
                url: `/admin/events/${event.slug}/${team.slug}/website/content`,
            },
            {
                Icon: SettingsSuggestIcon,
                label: 'Settings',
                url: `/admin/events/${event.slug}/${team.slug}/website/settings`,
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
