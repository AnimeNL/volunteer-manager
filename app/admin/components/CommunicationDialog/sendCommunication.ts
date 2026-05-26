// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { User } from '@lib/auth/User';
import { PromptFactory, type CommunicationPromptId } from '@lib/ai/PromptFactory';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { readSetting } from '@lib/Settings';
import db, { tUsers, tUsersCommunication } from '@lib/database';

/**
 * Parameters that can be passed to the `sendCommunication` function.
 */
interface SendCommunicationParams {
    /**
     * Identity of the person who will send this communication.
     */
    sender: User | number;

    /**
     * Identity of the person who will receive this communication.
     */
    recipient: User | number;

    /**
     * Subject of the message. Must not be empty.
     */
    subject: string;

    /**
     * Body of the message. Must not be empty. May contain Markdown.
     */
    message: string;

    /**
     * Metadata that identifies why this communication is being send.
     */
    metadata: {
        /**
         * Unique ID of the event the communication is in scope of.
         */
        eventId: number;

        /**
         * Unique ID of the team the communication is in scope of.
         */
        teamId: number;

        /**
         * Prompt that was used to generate the communication.
         */
        promptId: CommunicationPromptId;
    };
}

/**
 * Function that conveniently allows a communication to be distributed to a particular user, while
 * ensuring that all tracking is set up correctly.
 *
 * This method executes various database queries, but does not wait for the e-mail to have finished
 * distribution, as that could involve retries over a longer period of time.
 *
 * @param params Parameters defining the communication that should be send.
 * @returns Promise that resolves when the operation has completed, without a value.
 */
export async function sendCommunication(params: SendCommunicationParams): Promise<void> {
    const dbInstance = db;

    const senderUserId =
        typeof params.sender === 'number' ? params.sender : params.sender.id;
    const recipientUserId =
        typeof params.recipient === 'number' ? params.recipient : params.recipient.id;

    const usersForRecipient = tUsers.as('ufr');

    const { sender, recipient } = await dbInstance.selectFrom(tUsers)
        .innerJoin(usersForRecipient)
            .on(usersForRecipient.userId.equals(recipientUserId))
        .where(tUsers.userId.equals(senderUserId))
        .select({
            sender: {
                name: tUsers.name,
            },
            recipient: {
                email: usersForRecipient.username,
            },
        })
        .executeSelectOne();

    if (!recipient?.email)
        return;  // silently fail, this would be... strange

    const senderNameSuffix = await readSetting('communication-name-suffix');

    const communicationId = await dbInstance.insertInto(tUsersCommunication)
        .values({
            userId: recipientUserId,
            communicationEventId: params.metadata.eventId,
            communicationTeamId: params.metadata.teamId,
            communicationPromptId: params.metadata.promptId,
            communicationSenderId: senderUserId,
            communicationDate: dbInstance.currentZonedDateTime(),
        })
        .returningLastInsertedId()
        .executeInsert();

    const taskId = await SendEmailTask.Schedule({
        sender: `${sender.name}${senderNameSuffix || ''}`,

        message: {
            to: recipient.email,
            subject: params.subject,
            markdown: params.message,
        },

        attribution: {
            communicationId,
            sourceUserId: senderUserId,
            targetUserId: recipientUserId,
        },
    });

    const prompt = PromptFactory.createById(params.metadata.promptId);
    RecordLog({
        type: kLogType.AdminSendCommunication,
        severity: kLogSeverity.Info,
        sourceUser: senderUserId,
        targetUser: recipientUserId,
        data: {
            communicationId,
            regarding: prompt.metadata.regarding,
            taskId,
        },
    });
}
