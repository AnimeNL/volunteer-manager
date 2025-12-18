// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { EmailMessage } from './EmailMessage';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The message outbox page displays an individual message that was sent through the Volunteer
 * Manager. It includes all metainformation, including logs regarding the result. This entire page
 * is rendered client-side as it depends on an API.
 */
export default async function OutboxEmailPage(props: PageProps<'/admin/system/outbox/email/[id]'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    const params = await props.params;

    return <EmailMessage id={parseInt(params.id, 10)} />;
}

export const metadata: Metadata = {
    title: 'E-mail message | Outbox | AnimeCon Volunteer Manager',
};
