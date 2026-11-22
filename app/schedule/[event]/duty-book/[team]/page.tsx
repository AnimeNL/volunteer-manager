// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { DutyBookPage } from '../DutyBookPage';
import { generateScheduleMetadataFn } from '../../lib/generateScheduleMetadataFn';
import { requireAuthenticationContext } from '@lib/auth';
import { requireDutyBookAccess } from '../requireDutyBookAccess';
import db, { tDutyBook, tDutyBookViewers, tUsers } from '@lib/database';

/**
 * The <DutyBookTeamServerPage> component displays an overview of the Duty Book entries for a
 * specific team, including the ability to log a new entry for others to be aware of.
 */
export default async function DutyBookTeamServerPage(
    props: PageProps<'/schedule/[event]/duty-book/[team]'>)
{
    const params = await props.params;
    const context = await requireAuthenticationContext();

    const { event, hasUnrestrictedAccess, team, user } =
        await requireDutyBookAccess(context, params.event, params.team);

    const dutyBookViewersJoin = tDutyBookViewers.forUseInLeftJoin();

    const dbInstance = db;
    const incidents = await dbInstance.selectFrom(tDutyBook)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tDutyBook.dutyBookUserId))
        .leftJoin(dutyBookViewersJoin)
            .on(dutyBookViewersJoin.dutyBookId.equals(tDutyBook.dutyBookId))
                .and(dutyBookViewersJoin.dutyBookViewerUserId.equals(user.id))
        .where(tDutyBook.dutyBookEventId.equals(event.id))
            .and(tDutyBook.dutyBookTeamId.equals(team.id))
            .and(tDutyBook.dutyBookDeleted.isNull())
        .select({
            id: tDutyBook.dutyBookId,
            author: tUsers.name,
            authorUserId: tUsers.userId,
            date: dbInstance.dateTimeAsString(tDutyBook.dutyBookCreated),
            read: dutyBookViewersJoin.dutyBookViewerDate,

            hidden: tDutyBook.dutyBookHidden.isNotNull(),

            summary: tDutyBook.dutyBookAiSummary,
            text: tDutyBook.dutyBookIncident,
        })
        .orderBy(tDutyBook.dutyBookCreated, 'desc')
        .executeSelectMany();

    const processedIncidents = incidents.map(incident => {
        const canAccessContent =
            incident.authorUserId === user.id || !incident.hidden || hasUnrestrictedAccess;

        return {
            ...incident,
            read: !!incident.read,
            summary: canAccessContent ? incident.summary : undefined,
            text: canAccessContent ? incident.text : undefined,
        };
    });

    return (
        <DutyBookPage incidents={processedIncidents}
                      team={{ name: team.name, slug: team.slug }}
                      timezone={event.timeZone} />
    );
}

export const generateMetadata = generateScheduleMetadataFn([ 'Duty book' ]);
