// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ImapClient } from './ImapClient';
import db, { tEmailAccounts } from '@lib/database';

export type { ImapClient };
export type {
    ImapAddress,
    ImapAttachment,
    ImapMessage,
    ImapReadMessagesOptions,
} from './ImapTypes';

/**
 * Creates an `ImapClient` instance for the active e-mail account identified by `emailAccountId`.
 */
export async function createImapClient(emailAccountId: number): Promise<ImapClient> {
    const accountSettings = await db.selectFrom(tEmailAccounts)
        .where(tEmailAccounts.emailAccountId.equals(emailAccountId))
            .and(tEmailAccounts.emailAccountDeleted.isNull())
        .select({
            hostname: tEmailAccounts.emailAccountImapHostname,
            port: tEmailAccounts.emailAccountImapPort,
            username: tEmailAccounts.emailAccountImapUsername,
            password: tEmailAccounts.emailAccountImapPassword,
        })
        .executeSelectNoneOrOne();

    if (!accountSettings)
        throw new Error('Unable to instantiate the IMAP client, invalid account Id given.');

    if (!accountSettings.hostname || !accountSettings.port || !accountSettings.username ||
        !accountSettings.password)
    {
        throw new Error(
            `Unable to instantiate the IMAP client, account #${emailAccountId} has incomplete ` +
            'IMAP configuration.');
    }

    return new ImapClient({
        hostname: accountSettings.hostname,
        port: accountSettings.port,
        username: accountSettings.username,
        password: accountSettings.password,
    });
}
