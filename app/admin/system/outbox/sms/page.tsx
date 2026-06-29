// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';

import { OutboxDataTable } from '../OutboxDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionTabs } from '@app/admin/components/SectionTabs';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kTwilioOutboxType } from '@lib/database/Types';

/**
 * The outbox page summarises all outgoing SMS messages.
 */
export default async function OutboxSmsPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    return (
        <>
            <Section icon={ <TextsmsOutlinedIcon color="primary" /> } title="SMS outbox"
                     breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Outbox', href: '/admin/system/outbox' },
                         { label: 'SMS' },
                     ]}>
                <SectionIntroduction>
                    These are SMS messages that were sent through the portal.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <SectionTabs />
                <OutboxDataTable type={kTwilioOutboxType.SMS} />
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'SMS | Outbox | AnimeCon Volunteer Manager',
};
