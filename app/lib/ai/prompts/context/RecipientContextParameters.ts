// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tUsers } from '@lib/database';

/**
 * Parameters relaying context about the recipient of the message that's been generated.
 */
export type RecipientContextParameters<FieldName extends string = 'recipient'> = {
    [K in FieldName]: {
        name: string;
    };
};

/**
 * Example parameters that convey information about the intended recipient of a message.
 */
export const kRecipientContextExampleParameters: RecipientContextParameters['recipient'] = {
    name: 'Amara Thompson',
};

/**
 * Queries the recipient context for the given `userId` from the database. Will throw an exception
 * when the given `userId` does not exist or has been anonymised.
 */
export async function queryRecipientContext(db: DBConnection, userId: number)
    : Promise<RecipientContextParameters['recipient']>
{
    const name = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(userId))
            .and(tUsers.anonymized.isNull())
        .selectOneColumn(tUsers.name)
        .executeSelectOne();

    return { name };
}
