// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { CommunicationPromptId } from './PromptFactory';
import type { Language } from './Language';
import { PromptExecutor, type GetPromptParameters } from './PromptExecutor';
import { PromptFactory } from './PromptFactory';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { queryAuthorContext } from './prompts/context/AuthorContextParameters';
import { queryEventContext } from './prompts/context/EventContextParameters';
import { queryRecipientContext } from './prompts/context/RecipientContextParameters';
import { queryTeamContext } from './prompts/context/TeamContextParameters';
import { queryTeamInviteKeyContext } from './prompts/context/TeamInviteKeyContextParameters';
import { readSetting } from '@lib/Settings';
import db, { tEvents, tNardo, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

import * as prompts from './prompts';

/**
 * Zod types that describe the information required to execute a communication prompt.
 *
 * Note that `author` is omitted from all types and will be dynamically added based on the user who
 * is executing this prompt. This is intentional to mitigate the ability for people to impersonate
 * others when generating e-mails. It's also intentionally not fool proof, as the generated message
 * merely is a suggestion after all.
 */
const kCommunicationPromptData = {
    'application-approved': z.object({ eventId: z.number(), teamId: z.number() }),
    'application-rejected': z.object({ eventId: z.number(), teamId: z.number() }),
    'participation-cancelled': z.object({ eventId: z.number(), teamId: z.number() }),
    'participation-reinstated': z.object({ eventId: z.number(), teamId: z.number() }),
    'participation-reminder': z.object({ eventId: z.number(), teamId: z.number() }),
    'team-change': z.object({
        eventId: z.number(),
        oldTeamId: z.number(),
        newTeamId: z.number(),
    }),

    // TODO:
    'hotel-confirmation': z.object({ /* not supported */ }),

} as const satisfies { [K in CommunicationPromptId]: z.ZodObject };

/**
 * Helper type to strongly type a given `inputData` based on a known, verified prompt ID.
 */
export type TypedPromptData<K extends keyof typeof kCommunicationPromptData> =
    z.infer<typeof kCommunicationPromptData[K]>;

/**
 * Executes the communication prompt with the given `id`. All metadata expected by the prompt must
 * be given in the `params` through IDs, as it will be fetched from the database depending on the
 * signature expected by the prompt.
 *
 * This action may end up executing five+ queries on the database. This is expensive, but also
 * intentional because it substantially simplifies the code, which we choose to optimise for as this
 * operation will execute O(1000) times per year at most. The lion share of time spent will be in
 * the AI model execution that will happen immediately after in either case.
 *
 * @param id Unique ID of the communication prompt that should be executed.
 * @param recipientId Unique ID of the user to whom the message should be addressed.
 * @param language Language in which the response should be written.
 * @param params Free form (but validated) data required in order to execute the prompt.
 */
export async function executeCommunicationPrompt(
    id: CommunicationPromptId, recipientId: number, language: Language, params: unknown)
{
    'use server';

    if (!(id in kCommunicationPromptData))
        notFound();

    return executeServerAction(params, kCommunicationPromptData[id], async (inputData, props) => {
        executeAccessCheck(props.authenticationContext, { check: 'admin' });

        const dbInstance = db;

        const author = await queryAuthorContext(dbInstance, props.user.id);
        const recipient = await queryRecipientContext(dbInstance, recipientId);

        const prompt = PromptFactory.createById(id);
        const executor = PromptExecutor.forPrompt(prompt);

        let parameters: Parameters<typeof executor['execute']>[0] | undefined;

        switch (id) {
            case 'application-approved':
            case 'application-rejected':
            case 'participation-cancelled':
            case 'participation-reinstated': {
                const data = inputData as TypedPromptData<'participation-cancelled'>;
                parameters = {
                    author,
                    event: await queryEventContext(dbInstance, data.eventId),
                    recipient,
                    team: await queryTeamContext(dbInstance, data.teamId),
                } satisfies GetPromptParameters<prompts.ParticipationCancelledPrompt>;

                break;
            }

            case 'participation-reminder': {
                const data = inputData as TypedPromptData<'participation-reminder'>;
                parameters = {
                    author,
                    event: await queryEventContext(dbInstance, data.eventId),
                    recipient,
                    team: await queryTeamContext(dbInstance, data.teamId),
                    teamInviteKey:
                        await queryTeamInviteKeyContext(dbInstance, data.eventId, data.teamId),
                } satisfies GetPromptParameters<prompts.ParticipationReminderPrompt>;

                break;
            }

            case 'team-change': {
                const data = inputData as TypedPromptData<'team-change'>;
                parameters = {
                    author,
                    event: await queryEventContext(dbInstance, data.eventId),
                    recipient,
                    oldTeam: await queryTeamContext(dbInstance, data.oldTeamId),
                    newTeam: await queryTeamContext(dbInstance, data.newTeamId),
                } satisfies GetPromptParameters<prompts.TeamChangePrompt>;

                break;
            }
        }

        if (!parameters)
            notFound();

        await executor.addSystemPrompt(props.user.id, { language });

        const response = await executor.execute(parameters);
        if (!response.success)
            return response;

        return {
            success: true,

            subject: prompt.getSubject(parameters as any, language),
            message: response.text,
        };
    });
}

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
        executeAccessCheck(props.authenticationContext, {
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

        const executor = PromptExecutor.forPrompt(new prompts.NardoPersonalisedAdvicePrompt());
        const response = await executor.execute({
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

        if (!response.success)
            return response;

        return {
            success: true,
            message: response.text,
        };
    });
}

/**
 * Zod type that describes information required in order to execute a prompt with the example
 * parameters. The "language" and "personalisation" objects are only required for communication-
 * related prompts, and are otherwise optional.
 */
const kCommunicationExamplePromptData = z.object({
    id: z.string().nonempty(),

    language: z.string().optional(),
    personalisation: z.boolean().optional(),  // TODO: Take a User ID
});

/**
 * Server action to execute a prompt with the configured example parameters. The ID of the prompt
 * must be known, availability of other data depends on the type of prompt.
 */
export async function executePromptWithExampleParameters(formData: unknown) {
    'use server';

    return executeServerAction(formData, kCommunicationExamplePromptData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.ai',
        });

        const promptInstance = PromptFactory.createById(data.id);
        if (!promptInstance)
            notFound();

        const executor = PromptExecutor.forPrompt(promptInstance);

        switch (promptInstance.metadata.type) {
            case 'Communication': {
                let personalityPrompt: string | undefined;
                if (!data.personalisation)
                    personalityPrompt = await readSetting('ai-communication-personality-prompt');

                await executor.addSystemPrompt(props.user.id, {
                    language: data.language,
                    ...(!!personalityPrompt ? { personalityPrompt } : { /* nothing */ }),
                });

                break;
            }

            case 'Feature':
            case 'Internal':
                break;
        }

        const response = await executor.execute(promptInstance.exampleParameters);
        if (!response.success)
            return response;

        return {
            success: true,
            message: response.text,
        };
    });
}
