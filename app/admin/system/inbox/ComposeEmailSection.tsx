// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ComposeEmailSectionClientProps } from './ComposeEmailSectionClient';
import { ComposeEmailSectionClient } from './ComposeEmailSectionClient';
import db, { tUsers } from '@lib/database';

export type { ComposeEmailDefaultValues } from './ComposeEmailSectionClient';

/**
 * Props accepted by the `<ComposeEmailSection>` component.
 */
export type ComposeEmailSectionProps = Omit<ComposeEmailSectionClientProps, 'recipients'>;

/**
 * Shared server-rendered form section that loads known volunteer e-mail addresses for recipient
 * autocompletion and renders `<ComposeEmailSectionClient>`.
 */
export async function ComposeEmailSection(props: ComposeEmailSectionProps) {
    const volunteers = await db.selectFrom(tUsers)
        .where(tUsers.anonymized.isNull())
            .and(tUsers.username.isNotNull())
        .select({
            name: tUsers.name,
            username: tUsers.username,
        })
        .orderBy(tUsers.name, 'asc')
        .executeSelectMany();

    const recipients: string[] = [];
    const seenRecipients = new Set<string>();

    for (const volunteer of volunteers) {
        const address = volunteer.username?.trim();
        if (!address)
            continue;

        const formattedName = volunteer.name.trim();
        const option = formattedName ? `${formattedName} <${address}>` : address;
        if (seenRecipients.has(option))
            continue;

        seenRecipients.add(option);
        recipients.push(option);
    }

    return <ComposeEmailSectionClient {...props} recipients={recipients} />;
}
