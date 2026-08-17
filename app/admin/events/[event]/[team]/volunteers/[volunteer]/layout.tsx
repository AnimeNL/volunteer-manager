// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';

/**
 * The <EventTeamVolunteerLayout> is used to configure the accessible tabs for a volunteer.
 */
export default async function EventTeamVolunteerLayout(
    props: LayoutProps<'/admin/events/[event]/[team]/volunteers/[volunteer]'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    const id = (await props.params).volunteer;
    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: PersonOutlinedIcon,
                label: 'Overview',
                url: `/admin/events/${event.slug}/${team.slug}/volunteers/${id}`,
            },
            {
                Icon: ManageAccountsOutlinedIcon,
                label: 'Preferences',
                url: `/admin/events/${event.slug}/${team.slug}/volunteers/${id}/preferences`,
                urlMatchMode: 'prefix',
            },
            {
                Icon: OutboxOutlinedIcon,
                label: 'Communication',
                url: `/admin/events/${event.slug}/${team.slug}/volunteers/${id}/communication`,
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
