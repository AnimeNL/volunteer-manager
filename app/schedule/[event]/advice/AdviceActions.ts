// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { PromptExecutor } from '@lib/ai/PromptExecutor';
import { PromptFactory } from '@lib/ai/PromptFactory';
import { executeServerAction } from '@lib/serverAction';
import { formatDate } from '@lib/Temporal';
import { readSetting } from '@lib/Settings';
import { requireVolunteerAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tNardoPersonalised, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Zod type that describes the data required when generating personalised advice.
 */
const kGenerateAdviceData = z.object({
    advice: z.string().nonempty(),
    context: z.array(z.string().nonempty()).nonempty(),
    event: z.string().nonempty(),
});

/**
 * Server Action that generates a piece of personalised advice from Del a Rie Advies for the signed-
 * in volunteer.
 */
export async function generateAdvice(formData: unknown) {
    return executeServerAction(formData, kGenerateAdviceData, async (data, props) => {
        const { event } = await requireVolunteerAuthenticationWithEvent(
            props.authenticationContext, data.event);

        const enableNardoAdvice = await readSetting('schedule-del-a-rie-advies-genai');
        if (!enableNardoAdvice)
            forbidden();

        // -----------------------------------------------------------------------------------------
        // Step (1): Compose the context required for Del a Rie advies to be useful.
        // -----------------------------------------------------------------------------------------

        const currentLocalZonedDateTime = Temporal.Now.zonedDateTimeISO(event.timeZone);
        const currentLocalDate =
            formatDate(currentLocalZonedDateTime, 'dddd, MMMM Do, YYYY [at] HH:mm');

        const startDate = formatDate(event.startTime, 'dddd, MMMM Do, YYYY [at] h:mm A');
        const endDate = formatDate(event.endTime, 'dddd, MMMM Do, YYYY [at] h:mm A');

        const dbInstance = db;

        const usersEventsJoin = tUsersEvents.forUseInLeftJoin();
        const userContext = await dbInstance.selectFrom(tUsers)
            .leftJoin(usersEventsJoin)
                .on(usersEventsJoin.userId.equals(tUsers.userId))
                    .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
            .where(tUsers.userId.equals(props.user.id))
            .select({
                name: tUsers.firstName,
                events: dbInstance.count(usersEventsJoin.eventId),
            })
            .groupBy(tUsers.userId)
            .executeSelectNoneOrOne();

        if (!userContext)
            notFound();

        // -----------------------------------------------------------------------------------------

        const prompt = PromptFactory.createById('nardo-personalised-advice');
        const executor = PromptExecutor.forPrompt(prompt);

        const parameters: Parameters<typeof executor.execute>[0] = {
            additionalContext: data.context.join('\n'),
            advice: data.advice,
            audience: {
                name: userContext.name,
                tenure: userContext.events,
            },
            date: currentLocalDate,
            event: {
                endDate,
                location: event.location ?? 'The Netherlands',
                name: event.name,
                startDate,
            },
        };

        // -----------------------------------------------------------------------------------------
        // Step (2): Evaluate the prompt to understand input to the model.
        // -----------------------------------------------------------------------------------------

        const nardoPersonalisedInput = await prompt.evaluate(parameters);

        // -----------------------------------------------------------------------------------------
        // Step (3): Execute the prompt to obtain the generated advice.
        // -----------------------------------------------------------------------------------------

        const response = await executor.execute(parameters);
        if (!response.success) {
            return {
                success: false,
                error: response.error,
            };
        }

        const nardoPersonalisedOutput = response.text;

        // -----------------------------------------------------------------------------------------
        // Step (4): Store the returned prompt in the database for inspection.
        // -----------------------------------------------------------------------------------------

        const insertId = await dbInstance.insertInto(tNardoPersonalised)
            .set({
                nardoPersonalisedUserId: props.user.id,
                nardoPersonalisedDate: dbInstance.currentZonedDateTime(),
                nardoPersonalisedInput,
                nardoPersonalisedOutput,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateNardoPersonalisedAdvice')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .record({
                id: insertId,
            });

        // -----------------------------------------------------------------------------------------

        return {
            success: true,
            advice: nardoPersonalisedOutput,
        };
    });
}
