// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { EventDatesTable } from './EventDatesTable';
import { EventParticipatingTeams } from './EventParticipatingTeams';
import { EventSettings } from './EventSettings';
import { Section } from '@app/admin/components/Section';
import { SettingsHeader } from './SettingsHeader';
import { generateEventMetadataFn } from '../generateEventMetadataFn';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <EventSettingsPage> page allows event administrators to make changes to an event, such as its
 * name, slug, target team sizes and so on. These have an effect on the entire Volunteer Manager.
 */
export default async function EventSettingsPage(
    props: PageProps<'/admin/events/[event]/settings'>)
{
    const params = await props.params;

    const { event } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    const leaders = await getLeadersForEvent(event.id);

    return (
        <>
            <SettingsHeader event={event} />
            <EventSettings event={event.id} timezone={event.timezone} />
            <Section title="Deadlines and highlights">
                <EventDatesTable event={event} leaders={leaders} />
            </Section>
            <Section title="Participating teams">
                <EventParticipatingTeams event={event} />
            </Section>
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Settings');
