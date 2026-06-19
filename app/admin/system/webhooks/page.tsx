// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import WebhookIcon from '@mui/icons-material/Webhook';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { WebhookDataTable } from './WebhookDataTable';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The webhooks page lists all received webhooks from inbound services. These will be dealt with by
 * our system in a variety of ways, but all are (pre-authentication) stored for logging purposes.
 */
export default async function WebhooksPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    return (
        <Section icon={ <WebhookIcon color="primary" /> } title="Webhooks" breadcrumbs={[
            { label: 'Communication', href: '/admin/system/communication' },
            { label: 'Webhooks' },
        ]}>
            <SectionIntroduction>
                Webhooks are signals that the Volunteer Manager has received from external services,
                which it may have to act upon.
            </SectionIntroduction>
            <WebhookDataTable />
        </Section>
    );
}

export const metadata: Metadata = {
    title: 'Webhooks | AnimeCon Volunteer Manager',
};
