// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import { readUserSetting, writeUserSetting } from '@lib/UserSettings';
import { writeSetting } from '@lib/Settings';

/**
 * An example message is a string, pure and simple.
 */
type ExampleMessage = string;

/**
 * Guaranteed invalid ID to use in order to reference to a non-existing user.
 */
const kInvalidUserId = -1;

/**
 * Zod validator type that indicates what constitutes as a valid example message.
 */
const kValidMessage = z.string().nonempty();

/**
 * Reads example messages from the database, optionally for the given `userId`. Will return an
 * array of strings that's guaranteed to be valid.
 */
export async function readExampleMessages(userId?: number): Promise<ExampleMessage[]> {
    const storedMessages = await readUserSetting(userId ?? kInvalidUserId, 'ai-example-messages');
    const validatedStoredMessages =
        storedMessages?.filter(message => kValidMessage.safeParse(message).success);

    return validatedStoredMessages || [ /* no example messages */ ];
}

/**
 * Writes example messages to storage. The `messages`, which must be an array of strings, will be
 * written to the database with empty and invalid entries removed.
 * 
 * @param messages Array of messages that are the general writing examples.
 */
export async function writeExampleMessages(messages: ExampleMessage[]) {
    messages = messages.filter(message => kValidMessage.safeParse(message).success);
    return writeSetting(
        'ai-example-messages', !!messages.length ? messages : undefined);
}

/**
 * Writes example messages to storage for the given `userId`. The `messages`, which must be an array
 * of strings, will be written to the database with empty and invalid entries removed.
 *
 * @param userId Unique ID of the user for whom to write example messages.
 * @param messages Array of messages that are their writing examples.
 */
export async function writeExampleMessagesForUser(userId: number, messages: ExampleMessage[]) {
    messages = messages.filter(message => kValidMessage.safeParse(message).success);
    return writeUserSetting(
        userId, 'ai-example-messages', !!messages.length ? messages : undefined);
}
