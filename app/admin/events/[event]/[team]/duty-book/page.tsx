// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { DutyBookSummaryPrompt } from '@lib/ai/prompts/DutyBookSummaryPrompt';
import { IncidentTable } from './IncidentTable';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { SummaryAction } from './SummaryAction';
import { createAiClient } from '@lib/integrations/genai';
import { executeServerAction } from '@lib/serverAction';
import { formatDate } from '@lib/Temporal';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { readSetting } from '@lib/Settings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tDutyBook, tEvents, tTeams, tUsers } from '@lib/database';

/**
 * Zod type that describes that no data is expected for a Server Action.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Server action that will be called when an administrator requests a summary of the Duty Book to
 * be generated. We don't provide guarantees towards the stability of these summaries.
 */
async function generateSummary(event: string, team: string) {
    'use server';
    return executeServerAction(new FormData, kNoDataRequired, async (data, props) => {
        if (!props.access.can('event.duty-book'))
            forbidden();

        const dutyBookJoin = tDutyBook.forUseInLeftJoin();

        const dutyBookContents = await db.selectFrom(tEvents)
            .innerJoin(tTeams)
                .on(tTeams.teamSlug.equals(team))
            .leftJoin(dutyBookJoin)
                .on(dutyBookJoin.dutyBookEventId.equals(tEvents.eventId))
                    .and(dutyBookJoin.dutyBookDeleted.isNull())
            .where(tEvents.eventSlug.equals(event))
            .select({
                event: tEvents.eventName,
                team: tTeams.teamName,
                incidents: db.aggregateAsArray({
                    date: dutyBookJoin.dutyBookCreated,
                    incident: dutyBookJoin.dutyBookIncident,
                })
            })
            .groupBy(tEvents.eventId, tTeams.teamId)
            .executeSelectNoneOrOne();

        if (!dutyBookContents || !dutyBookContents?.incidents.length)
            return { success: false, error: 'The Duty Book is empty, nothing to summarise.' };

        dutyBookContents.incidents.sort((lhs, rhs) =>
            lhs.date.epochMilliseconds - rhs.date.epochMilliseconds);

        const input: string[] = [ /* none yet */ ];
        for (const { date, incident } of dutyBookContents.incidents)
            input.push(`[${formatDate(date, 'dddd [at] HH:mm')}]: ${incident}`);

        const promptInstance = new DutyBookSummaryPrompt();
        const prompt = await promptInstance.evaluate({
            event: dutyBookContents.event,
            input: JSON.stringify(input),
            team: dutyBookContents.team,
        });

        const client = await createAiClient();
        const summary = await client.generateText({ prompt });

        if (!summary.success)
            return { success: false, error: summary.error };

        return {
            success: true,
            summary: summary.text,
        };
    });
}

/**
 * The Duty Book is the place where volunteers log information about incidents that happens during
 * the festival, so that others are aware of the specifics and/or the associated pictures.
 */
export default async function EventTeamDutyBookPage(
    props: PageProps<'/admin/events/[event]/[team]/duty-book'>)
{
    const { access, event, team } = await verifyAccessAndFetchPageInfo(props.params);
    // TODO: Check for "event.duty-book" permission?

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

    const generateSummaryFn = generateSummary.bind(null, event.slug, team.slug);

    return (
        <Section title="Duty book" subtitle={event.shortName}
                 headerAction={ <SummaryAction generateSummaryFn={generateSummaryFn} /> }>
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
