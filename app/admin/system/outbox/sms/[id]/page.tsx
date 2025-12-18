// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { TwilioDetailsPage } from '../../TwilioDetailsPage';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kTwilioOutboxType } from '@lib/database/Types';

/**
 * The outbox page details an outgoing SMS message, with all information we have collected in
 * the database regarding delivery of that message.
 */
export default async function OutboxSmsDetailsPage(
    props: PageProps<'/admin/system/outbox/sms/[id]'>)
{
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    const params = await props.params;

    return <TwilioDetailsPage type={kTwilioOutboxType.SMS} id={parseInt(params.id, 10)} />;
}

export const metadata: Metadata = {
    title: 'SMS | Outbox | AnimeCon Volunteer Manager',
};
