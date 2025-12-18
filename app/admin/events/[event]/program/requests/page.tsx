// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { RequestDataTable } from './RequestDataTable';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEventsTeams, tTeams } from '@lib/database';

/**
 * The <ProgramRequestsPage> component lists the program entries where the organiser has requested
 * help from the volunteering teams. Requests must be managed directly by our team.
 */
export default async function ProgramRequestsPage(
    props: PageProps<'/admin/events/[event]/program/requests'>)
{
    const { access, event } = await verifyAccessAndFetchPageInfo(props.params);

    const comprehensiveLeaders = await getLeadersForEvent(event.id);
    const leaders = comprehensiveLeaders.map(leader => leader.label);

    const readOnly = !access.can('event.requests', { event: event.slug });

    const teams = await db.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
                .and(tTeams.teamFlagProgramRequests.equals(/* true= */ 1))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true = */ 1))
        .select({
            id: tTeams.teamId,
            colour: tTeams.teamColourLightTheme,
            name: tTeams.teamTitle,
            slug: tTeams.teamSlug,
        })
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    return <RequestDataTable event={event.slug} leaders={leaders} readOnly={readOnly}
                             teams={teams} />;
}

export const generateMetadata = generateEventMetadataFn('Program requests');
