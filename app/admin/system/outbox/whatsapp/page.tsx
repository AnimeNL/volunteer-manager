// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { OutboxDataTable } from '../OutboxDataTable';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kTwilioOutboxType } from '@lib/database/Types';

/**
 * The outbox page summarises all outgoing WhatsApp messages. This includes both human readable
 * messages, as well as reactions such as an emoji response.
 */
export default async function OutboxWhatsAppPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    return <OutboxDataTable type={kTwilioOutboxType.WhatsApp} />;
}

export const metadata: Metadata = {
    title: 'WhatsApp | Outbox | AnimeCon Volunteer Manager',
};
