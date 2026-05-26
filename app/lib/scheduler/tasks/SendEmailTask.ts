// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { TaskWithParams } from '../Task';
import { createEmailClient } from '@lib/integrations/email';
import { scheduleTask } from '@lib/scheduler';

/**
 * Parameter scheme applying to the `SendEmailTask`.
 */
const kSendEmailTaskParamScheme = z.object({
    /**
     * Sender of the message.
     */
    sender: z.string(),

    /**
     * Contents of the message.
     */
    message: z.object({
        /**
         * The e-mail address to which the message should be send.
         */
        to: z.string().email(),

        /**
         * Subject of the message.
         */
        subject: z.string(),

        /**
         * Markdown content from which the message's content will be derived.
         */
        markdown: z.string(),
    }),

    /**
     * All e-mail messages distributed by the Volunteer Manager will be strictly attributed.
     */
    attribution: z.object({
        /**
         * When known, the communication ID this message should be associated with.
         */
        communicationId: z.number().optional(),

        /**
         * User Id of the user who initiated sending this message.
         */
        sourceUserId: z.number(),

        /**
         * User Id of the user who will receive this message.
         */
        targetUserId: z.number(),
    }),
});

/**
 * Type definition of the parameter scheme, to be used by TypeScript.
 */
type TaskParams = z.infer<typeof kSendEmailTaskParamScheme>;

/**
 * A task that actually sends e-mail. We use the
 */
export class SendEmailTask extends TaskWithParams<TaskParams> {
    /**
     * Helper function to schedule sending an e-mail. The message will be composed and sent beyond
     * the scope of the request during which this task is being scheduled. Returns the task Id.
     */
    static async Schedule(request: TaskParams, delayMs?: number): Promise<number> {
        return scheduleTask<TaskParams>({
            taskName: 'SendEmailTask',
            params: request,
            delayMs: delayMs ?? 0,
        });
    }

    override validate(params: unknown): TaskParams | never {
        return kSendEmailTaskParamScheme.parse(params);
    }

    override async execute(params: TaskParams): Promise<boolean> {
        const client = await createEmailClient();
        const message = client.createMessage()
            .setTo(params.message.to)
            .setSubject(params.message.subject)
            .setMarkdown(params.message.markdown);

        const result = await client.sendMessage({
            sender: params.sender,
            message,
            communicationId: params.attribution.communicationId,
            sourceUser: params.attribution.sourceUserId,
            targetUser: params.attribution.targetUserId,
        });

        return !!result.messageId;
    }
}
