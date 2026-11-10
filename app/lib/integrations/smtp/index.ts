// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SmtpClient } from './SmtpClient';
import db, { tEmailAccounts } from '@lib/database';

export type { SmtpClient };

/**
 * Gets an instance of the SMTP client infrastructure, which allows messages to be sent across
 * the internet. Settings are stored in the Integration section.
 */
export async function createSmtpClient(emailAccountId: number): Promise<SmtpClient> {
    const accountSettings = await db.selectFrom(tEmailAccounts)
        .where(tEmailAccounts.emailAccountId.equals(emailAccountId))
        .select({
            hostname: tEmailAccounts.emailAccountSmtpHostname,
            port: tEmailAccounts.emailAccountSmtpPort,
            username: tEmailAccounts.emailAccountSmtpUsername,
            password: tEmailAccounts.emailAccountSmtpPassword,
        })
        .executeSelectNoneOrOne();

    if (!accountSettings)
        throw new Error('Unable to instantiate the SMTP client, invalid account Id given.');

    return new SmtpClient(emailAccountId, accountSettings);
}
