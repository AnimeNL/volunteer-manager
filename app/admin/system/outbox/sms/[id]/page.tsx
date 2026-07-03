// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';

import { Section } from '@app/admin/components/Section';
import { TwilioDetailsPage } from '../../TwilioDetailsPage';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kTwilioOutboxType } from '@lib/database/Types';

/**
 * The outbox page details an outgoing SMS message, with all information we have collected in
 * the database regarding delivery of that message.
 */
export default async function OutboxSmsDetailsPage(
    props: PageProps<'/admin/system/outbox/sms/[id]'>)
{
    const authenticationContext = await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    const params = await props.params;

    return (
        <>
            <Section icon={ <TextsmsOutlinedIcon color="primary" /> }
                     title={`SMS message #${params.id}`}
                     breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Outbox', href: '/admin/system/outbox' },
                         { label: 'SMS', href: '/admin/system/outbox/sms' },
                         { label: `#${params.id}` },
                     ]}>
                <SectionIntroduction>
                    Detailed information about a message we sent through SMS.
                </SectionIntroduction>
            </Section>
            <TwilioDetailsPage authenticationContext={authenticationContext}
                               type={kTwilioOutboxType.SMS} id={parseInt(params.id, 10)} />
        </>
    );
}

export const metadata: Metadata = {
    title: 'SMS | Outbox | AnimeCon Volunteer Manager',
};
