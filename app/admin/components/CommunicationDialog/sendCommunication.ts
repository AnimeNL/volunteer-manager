// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { User } from '@lib/auth/User';
import { LogBuilder } from '@lib/log/index';
import { PromptFactory, type CommunicationPromptId } from '@lib/ai/PromptFactory';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { getTeam } from '@lib/cache';
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
     * Identity or e-mail address of the person who will receive this communication.
     */
    recipient: User | number | string;

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
         * Unique ID of the team the communication is in scope of, when applicable.
         */
        teamId?: number;

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

    let recipientUserId: number | undefined;
    let recipientEmail: string | undefined;

    if (typeof params.recipient === 'string') {
        recipientEmail = params.recipient;
    } else {
        recipientUserId =
            typeof params.recipient === 'number' ? params.recipient : params.recipient.id;
    }

    const usersForRecipient = tUsers.forUseInLeftJoinAs('ufr');

    const { sender, recipient } = await dbInstance.selectFrom(tUsers)
        .leftJoin(usersForRecipient)
            .on(usersForRecipient.userId.equals(recipientUserId ?? -1))
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

    const toEmail = recipientEmail ?? recipient?.email;
    if (!toEmail)
        throw new Error(`The recipient (${recipientUserId}) does not have a known e-mail address.`);

    let accountId: number | undefined;
    if (params.metadata.teamId) {
        const team = await getTeam(params.metadata.teamId);
        if (!team)
            throw new Error(`The team (${params.metadata.teamId}) does not exist.`);

        accountId = team.integrations.emailAccountId;
    }

    const senderNameSuffix = await readSetting('communication-name-suffix');

    let communicationId: number | undefined;
    if (!!recipientUserId && !!params.metadata.teamId) {
        communicationId = await dbInstance.insertInto(tUsersCommunication)
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
    }

    const taskId = await SendEmailTask.Schedule({
        accountId,
        sender: `${sender.name}${senderNameSuffix || ''}`,

        message: {
            to: toEmail,
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

    LogBuilder.for('SendCommunication')
        .withInitiatorUser(senderUserId)
        .withAffectedUser(recipientUserId)
        .record({
            communicationId,
            regarding: prompt.metadata.regarding,
            taskId,
        });
}
