// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextPageParams } from '@lib/NextRouterParams';
import { EventDatesTable } from './EventDatesTable';
import { EventParticipatingTeams } from './EventParticipatingTeams';
import { EventSettings } from './EventSettings';
import { EventTeamSettings } from './EventTeamSettings';
import { Section } from '@app/admin/components/Section';
import { SettingsHeader } from './SettingsHeader';
import { generateEventMetadataFn } from '../generateEventMetadataFn';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

import db, { tEventsTeams, tTeams } from '@lib/database';

/**
 * The <EventSettingsPage> page allows event administrators to make changes to an event, such as its
 * name, slug, target team sizes and so on. These have an effect on the entire Volunteer Manager.
 */
export default async function EventSettingsPage(props: NextPageParams<'event'>) {
    const params = await props.params;

    const { event } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    const dbInstance = db;
    const teamSettings = await dbInstance.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            team: {
                id: tTeams.teamId,
                name: tTeams.teamName,
                colour: tTeams.teamColourLightTheme,
            },
            settings: {
                enableApplicationsStart:
                    dbInstance.dateTimeAsString(tEventsTeams.enableApplicationsStart),
                enableApplicationsEnd:
                    dbInstance.dateTimeAsString(tEventsTeams.enableApplicationsEnd),
                enableRegistrationStart:
                    dbInstance.dateTimeAsString(tEventsTeams.enableRegistrationStart),
                enableRegistrationEnd:
                    dbInstance.dateTimeAsString(tEventsTeams.enableRegistrationEnd),
                enableScheduleStart:
                    dbInstance.dateTimeAsString(tEventsTeams.enableScheduleStart),
                enableScheduleEnd:
                    dbInstance.dateTimeAsString(tEventsTeams.enableScheduleEnd),
            },
        })
        .projectingOptionalValuesAsNullable()
        .orderBy('team.name', 'asc')
        .executeSelectMany();

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
            { teamSettings.map(({ settings, team }) =>
                <EventTeamSettings key={team.id} event={event.id} settings={settings!} team={team}
                                   timezone={event.timezone} /> )}
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Settings');
