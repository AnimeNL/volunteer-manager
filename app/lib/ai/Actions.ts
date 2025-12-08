// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { NardoPersonalisedAdvicePrompt } from './prompts/NardoPersonalisedAdvicePrompt';
import { PromptExecutor } from './PromptExecutor';
import { PromptFactory } from './PromptFactory';
import { Temporal } from '@lib/Temporal';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents, tNardo, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Zod type that describes information required in order to execute a model.
 */
const kNardoPersonalisedAdviceData = z.object({
    advice: z.number(),
    event: z.string(),
    volunteer: z.number(),
});

/**
 * Server action to execute NardoPersonalisedAdvicePrompt.
 */
export async function executeNardoPersonalisedAdvicePrompt(formData: unknown) {
    'use server';

    return executeServerAction(formData, kNardoPersonalisedAdviceData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'system.internals.ai',
        });

        // TODO: All this manual work doesn't scale for an example tool. This action either has to
        // move elsewhere, or we should find a scalable machanism to approach this.

        const dbInstance = db;

        const advice = await dbInstance.selectFrom(tNardo)
            .where(tNardo.nardoId.equals(data.advice))
            .selectOneColumn(tNardo.nardoAdvice)
            .executeSelectOne();

        const audience = await dbInstance.selectFrom(tUsers)
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.userId.equals(tUsers.userId))
                    .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .where(tUsers.userId.equals(data.volunteer))
            .select({
                name: tUsers.firstName,
                tenure: dbInstance.count(tUsersEvents.eventId),
            })
            .executeSelectOne();

        const event = await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventSlug.equals(data.event))
            .select({
                name: tEvents.eventName,
                location: tEvents.eventLocation,
                startDate: tEvents.eventStartTime,
                endDate: tEvents.eventEndTime,
            })
            .executeSelectOne();

        const executor = PromptExecutor.forPrompt(new NardoPersonalisedAdvicePrompt());
        if (!await executor.validate())
            return { success: false, error: 'The prompt could not be validated.' };

        try {
            const result = await executor.execute({
                additionalContext: 'This is their last shift.',
                advice,
                audience,
                date: event.endDate.toPlainDate.toString(),
                event: {
                    name: event.name,
                    location: event.location || 'The Netherlands',
                    startDate: event.startDate.toPlainDate().toString(),
                    endDate: event.endDate.toPlainDate().toString(),
                },
            });

            if (!result.success)
                return result;

            return {
                success: true,
                message: result.text,
            };

        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });
}

/**
 * Zod type that describes information required in order to execute a prompt with exampl parameters.
 */
const kPromptWithExampleParametersData = z.object({
    id: z.string().nonempty(),
    language: z.string(),
    personalisation: z.boolean(),
});

/**
 * Server action to execute a prompt with the configured example parameters. The ID of the prompt
 * must be known, and both the language and personalisation options are available as payload.
 */
export async function executePromptWithExampleParameters(formData: unknown) {
    'use server';

    return executeServerAction(formData, kPromptWithExampleParametersData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'system.internals.ai',
        });

        const prompt = PromptFactory.createById(data.id);
        const systemPrompt = PromptFactory.createById('system-prompt');

        if (!prompt || !systemPrompt)
            notFound();

        const evaluatedPrompt = await prompt.evaluate(prompt.exampleParameters);
        const evaluatedSystemPrompt = await systemPrompt.evaluate({
            date: Temporal.Now.plainDateISO().toString(),
            language: data.language,
        });

        // TODO: Compose the example messages, and attach them to the prompt
        // TODO: Execute the composed package

        return {
            success: true,
            message: [ evaluatedPrompt, evaluatedSystemPrompt ].join('\n\n'),
        };
    });
}
