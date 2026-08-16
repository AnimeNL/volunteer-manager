// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { DutyBookPage } from './DutyBookPage';
import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';
import { requireAuthentication } from '../requireAuthentication';
import db, { tDutyBook, tDutyBookViewers, tUsers } from '@lib/database';

import { kAnyTeam } from '@lib/auth/AccessList';

/**
 * The <DutyBookPage> component displays an overview of the Duty Book entries, including the ability
 * to log a new entry in the Duty Book for others to be aware of.
 */
export default async function DutyBookServerPage(props: PageProps<'/schedule/[event]/duty-book'>) {
    const { access, event, user } = await requireAuthentication(props);

    const hasUnrestrictedAccess = access.can('event.duty-book', 'read', {
        event: event.slug,
        team: kAnyTeam,  // todo: Scope this to the specific team page
    });

    const dutyBookViewersJoin = tDutyBookViewers.forUseInLeftJoin();

    const dbInstance = db;
    const incidents = await dbInstance.selectFrom(tDutyBook)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tDutyBook.dutyBookUserId))
        .leftJoin(dutyBookViewersJoin)
            .on(dutyBookViewersJoin.dutyBookId.equals(tDutyBook.dutyBookId))
                .and(dutyBookViewersJoin.dutyBookViewerUserId.equals(user.id))
        .where(tDutyBook.dutyBookEventId.equals(event.id))
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
            text: canAccessContent ? incident.text : undefined,
        };
    });

    return <DutyBookPage incidents={processedIncidents} timezone={event.timeZone} />;
}

export const generateMetadata = generateScheduleMetadataFn([ 'Duty book' ]);
