// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { EmailClient } from './EmailClient';
import db, { tEmailAccounts } from '@lib/database';

/**
 * Gets an instance of the e-mail client infrastructure, which allows messages to be sent across
 * the internet. Settings are stored in the Integration section.
 */
export async function createEmailClient(emailAccountId: number): Promise<EmailClient> {
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
        throw new Error('Unable to instantiate the e-mail client, invalid account Id given.');

    return new EmailClient(emailAccountId, accountSettings);
}
