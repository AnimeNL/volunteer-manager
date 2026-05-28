// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound, unauthorized } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../createDataTableApi';
import { PromptFactory } from '@lib/ai/PromptFactory';
import { RecordLog, kLogType } from '@lib/Log';
import { Temporal, formatDate } from '@lib/Temporal';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import { readSetting } from '@lib/Settings';
import db, { tNardoPersonalised, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';
import { PromptExecutor } from '@lib/ai/PromptExecutor';

/**
 * Row model for an individual piece of personalised advice offered by Del a Rie Advies.
 */
const kNardoPersonalisedRowModel = z.object({
    /**
     * Unique ID of the piece of personalised advice. Only exposed to administrators.
     */
    id: z.number().optional(),

    /**
     * Date and time at which the advice was generated. Only exposed to administrators.
     */
    date: z.string().optional(),

    /**
     * User ID of the user who requested this advice. Only exposed to administrators.
     */
    userId: z.number().optional(),

    /**
     * Name of the user who requested this advice. Only exposed to administrators.
     */
    userName: z.string().optional(),

    /**
     * Input to the personalised advice, i.e. what should be considered? Must be provided when new
     * advice is being generated; will only be exposed to administrators thereafter.
     */
    input: z.string().optional(),

    /**
     * The piece of personalised advice that has been created.
     */
    output: z.string(),

    /**
     * Client-side provided context, only considered when new advice is being generated.
     */
    context: z.array(z.string()).optional(),

    /**
     * Client-side provided context advice, which is input to the situation.
     */
    contextAdvice: z.string().optional(),

    /**
     * Client-side provided context event, as a URL-safe event slug.
     */
    contextEvent: z.string().optional(),
});

/**
 * The Personalised Nardo API does not require any context.
 */
const kNardoPersonalisedContext = z.never();

/**
 * Export type definitions so that the Nardo DataTable API can be used in `callApi()`.
 */
export type NardoPersonalisedEndpoints =
    DataTableEndpoints<typeof kNardoPersonalisedRowModel, typeof kNardoPersonalisedContext>;

/**
 * Export type definition for the Nardo DataTable API's Row Model.
 */
export type NardoPersonalisedRowModel = z.infer<typeof kNardoPersonalisedRowModel>;

/**
 * The Del a Rie Advies API is implemented as a regular, editable DataTable API. All operations are
 * gated on Nardo permission, and mutations will be logged as appropriate.
 */
export const { GET, POST } =
createDataTableApi(kNardoPersonalisedRowModel, kNardoPersonalisedContext, {
    accessCheck(request, action, props) {
        switch (action) {
            case 'create':
                if (!props.authenticationContext.user)
                    unauthorized();

                if (!props.authenticationContext.events.size)
                    forbidden();

                // This API is publicly available for any signed in user who is participating in at
                // least one unsuspended event. A check whether the feature is enabled is included
                // in the implementation of the `create()` function.
                break;

            case 'list':
                executeAccessCheck(props.authenticationContext, {
                    check: 'admin',
                    permission: 'organisation.nardo',
                });

                break;

            case 'delete':
            case 'get':
            case 'reorder':
            case 'update':
                throw new Error('Not supported by this API');
        }
    },

    async create(request, props) {
        if (!props.user)
            unauthorized();  // already handled by the permission check, make TypeScript happy

        if (!request.row.context?.length || !request.row.contextAdvice || !request.row.contextEvent)
            notFound();

        const event = await getEventBySlug(request.row.contextEvent);
        if (!event)
            notFound();

        const enableNardoAdvice = await readSetting('schedule-del-a-rie-advies-genai');
        if (!enableNardoAdvice)
            forbidden();

        // -----------------------------------------------------------------------------------------
        // Step (1): Compose the context required for Del a Rie advies to be useful.
        // -----------------------------------------------------------------------------------------

        const currentLocalZonedDateTime = Temporal.Now.zonedDateTimeISO(event.timezone);
        const currentLocalDate =
            formatDate(currentLocalZonedDateTime, 'dddd, MMMM Do, YYYY [at] HH:mm');

        const startDate = formatDate(event.temporalStartTime, 'dddd, MMMM Do, YYYY [at] h:mm A');
        const endDate = formatDate(event.temporalEndTime, 'dddd, MMMM Do, YYYY [at] h:mm A');

        const dbInstance = db;

        const usersEventsJoin = tUsersEvents.forUseInLeftJoin();
        const userContext = await dbInstance.selectFrom(tUsers)
            .leftJoin(usersEventsJoin)
                .on(usersEventsJoin.userId.equals(tUsers.userId))
                    .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
            .where(tUsers.userId.equals(props.user?.id))
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
            additionalContext: request.row.context.join('\n'),
            advice: request.row.contextAdvice,
            audience: {
                name: userContext.name,
                tenure: userContext.events,
            },
            date: '',
            event: {
                endDate,
                location: event.location ?? 'The Netherlands',
                name: event.name,
                startDate,
            },
        };

        // -----------------------------------------------------------------------------------------
        // Step (2): Evalute the prompt to understand input to the model.
        // -----------------------------------------------------------------------------------------

        const nardoPersonalisedInput = await prompt.evaluate(parameters);

        // -----------------------------------------------------------------------------------------
        // Step (3): Execute the prompt to obtain the generated advice.
        // -----------------------------------------------------------------------------------------

        let nardoPersonalisedOutput: string;
        try {
            const response = await executor.execute(parameters);
            if (!response.success)
                throw new Error(response.error);

            nardoPersonalisedOutput = response.text;

        } catch (error: any) {
            return {
                success: false,
                error: error.message,
            };
        }

        // -----------------------------------------------------------------------------------------
        // Step (4): Store the returned prompt in the database for inspection.
        // -----------------------------------------------------------------------------------------

        await dbInstance.insertInto(tNardoPersonalised)
            .set({
                nardoPersonalisedUserId: props.user.id,
                nardoPersonalisedDate: dbInstance.currentZonedDateTime(),
                nardoPersonalisedInput,
                nardoPersonalisedOutput,
            })
            .executeInsert();

        // -----------------------------------------------------------------------------------------

        return {
            success: true,
            row: {
                id: 0,
                output: nardoPersonalisedOutput,
            },
        }
    },

    async list({ pagination, sort }, props) {
        const dbInstance = db;
        const results = await dbInstance.selectFrom(tNardoPersonalised)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tNardoPersonalised.nardoPersonalisedUserId))
            .select({
                id: tNardoPersonalised.nardoPersonalisedId,
                date: dbInstance.dateTimeAsString(tNardoPersonalised.nardoPersonalisedDate),
                userId: tUsers.userId,
                userName: tUsers.name,
                input: tNardoPersonalised.nardoPersonalisedInput,
                output: tNardoPersonalised.nardoPersonalisedOutput,
            })
            .orderByFromStringIfValue(sort ? `${sort.field} ${sort.sort}` : null)
            .limit(pagination ? pagination.pageSize : 50)
                .offsetIfValue(pagination ? pagination.page * pagination.pageSize : 0)
            .executeSelectPage();

        return {
            success: true,
            rowCount: results.count,
            rows: results.data,
        };
    },

    async writeLog(request, mutation, props) {
        if (mutation === 'Created') {
            RecordLog({
                type: kLogType.NardoPersonalisedAdvice,
                sourceUser: props.user!.id,
                data: { id: request.id },
            });
        }
    },
});
