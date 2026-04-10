// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { IncidentSummaryPrompt } from '@lib/ai/prompts';
import { Publish } from '@lib/subscriptions';
import { TaskWithParams } from '../Task';
import { createAiClient } from '@lib/integrations/genai';
import { scheduleTask } from '@lib/scheduler';
import db, { tDutyBook, tUsers } from '@lib/database';

import { kSubscriptionType } from '@lib/subscriptions';

/**
 * Parameter scheme applying to the `DutyBookSummaryTask`.
 */
const kDutyBookSummaryTaskParamScheme = z.object({
    /**
     * Unique ID of the Duty Book entry for which a summary should be generated.
     */
    id: z.number(),

    /**
     * Whether the Duty Book entry should be published after generation succeeds.
     * @default true
     */
    publish: z.boolean().optional(),
});

/**
 * Type definition of the parameter scheme, to be used by TypeScript.
 */
type TaskParams = z.infer<typeof kDutyBookSummaryTaskParamScheme>;

/**
 * A task that generates an AI summary of a Duty Book entry. Where full entries might be sensitive
 * and thus have to be hidden from volunteers, summaries can be moderated and scraped, either by AI
 * or by a human, so that a high level idea is always available.
 */
export class DutyBookSummaryTask extends TaskWithParams<TaskParams> {
    /**
     * Helper function to schedule generating an AI summary for a Duty Book task. The entry will
     * be published by default, but that can be toggled through the parameters.
     */
    static async Schedule(request: TaskParams, delayMs?: number): Promise<number> {
        return scheduleTask<TaskParams>({
            taskName: 'DutyBookSummaryTask',
            params: {
                id: request.id,
                publish: request.publish ?? true,
            },
            delayMs: delayMs ?? 0,
        });
    }

    override validate(params: unknown): TaskParams | never {
        return kDutyBookSummaryTaskParamScheme.parse(params);
    }

    override async execute(params: TaskParams): Promise<boolean> {
        const dbInstance = db;

        const incident = await dbInstance.selectFrom(tDutyBook)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tDutyBook.dutyBookUserId))
            .where(tDutyBook.dutyBookId.equals(params.id))
                .and(tDutyBook.dutyBookDeleted.isNull())
            .select({
                summary: tDutyBook.dutyBookAiSummary,
                text: tDutyBook.dutyBookIncident,
                user: {
                    id: tUsers.userId,
                    name: tUsers.name,
                },
            })
            .executeSelectNoneOrOne();

        if (!incident) {
            this.log.error('The Duty Book incident could not be found.');
            return false;
        }

        if (!!incident.summary) {
            this.log.warning('The Duty Book incident already has a summary. Skipping.');
            return true;
        }

        this.log.info('A summary is necessary for this Duty Book entry, generating...');

        const promptInstance = new IncidentSummaryPrompt();
        const prompt = await promptInstance.evaluate({
            incident: incident.text,
        });

        const client = await createAiClient();
        const summary = await client.generateText({ prompt });

        if (!summary.success) {
            this.log.error('Unable to generate a summary using Gemini: ' + summary.error);
            return false;
        }

        await dbInstance.update(tDutyBook)
            .set({
                dutyBookAiSummary: summary.text,
            })
            .where(tDutyBook.dutyBookId.equals(params.id))
            .executeUpdate();

        this.log.info('A summary has been generated. Thank you Gemini.');
        this.log.debug('Summary: ' + summary.text);

        if (params.publish) {
            this.log.info('Scheduling a publication to announce the Duty Book incident...');
            await Publish({
                type: kSubscriptionType.Incident,
                sourceUserId: incident.user.id,
                message: {
                    author: incident.user.name,
                    summary: summary.text.replace(/\.+$/, ''),  // remove trailing period(s)
                    requestId: params.id,
                },
            });
            this.log.info('Publication has been scheduled.');
        } else {
            this.log.info('Publishing has not been requested. Skipping.');
        }

        return true;
    }
}
