// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { IncidentTable } from './IncidentTable';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { readSetting } from '@lib/Settings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tDutyBook, tUsers } from '@lib/database';

/**
 * The Duty Book is the place where volunteers log information about incidents that happens during
 * the festival, so that others are aware of the specifics and/or the associated pictures.
 */
export default async function EventTeamDutyBookPage(
    props: PageProps<'/admin/events/[event]/[team]/duty-book'>)
{
    const { access, event, team } = await verifyAccessAndFetchPageInfo(props.params);

    const dutyBookEnabled = await readSetting('schedule-duty-book');
    if (!dutyBookEnabled || !team.flagEnableDutyBook)
        notFound();

    const dbInstance = db;
    const incidents = await db.selectFrom(tDutyBook)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tDutyBook.dutyBookUserId))
        .where(tDutyBook.dutyBookEventId.equals(event.id))
            .and(tDutyBook.dutyBookDeleted.isNull())
        .select({
            id: tDutyBook.dutyBookId,
            date: dbInstance.dateTimeAsString(tDutyBook.dutyBookCreated),
            summary: tDutyBook.dutyBookAiSummary,
            incident: tDutyBook.dutyBookIncident,
            userId: tUsers.userId,
            userName: tUsers.name,
            hidden: tDutyBook.dutyBookHidden.isNotNull(),
        })
        .orderBy('date', 'desc')
        .executeSelectMany();

    return (
        <Section title="Duty book" subtitle={event.shortName}>
            <SectionIntroduction>
                The duty book lists all reported incidents during this festival. The information
                can be consumed in the portal as well.
            </SectionIntroduction>
            <IncidentTable enableAccountLinks={ access.can('organisation.accounts', 'read') }
                           incidents={incidents} />
        </Section>
    );
}

export const generateMetadata = generateEventMetadataFn('Duty book');
