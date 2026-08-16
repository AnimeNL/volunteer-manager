// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';

import { OutboxDataTable } from '../OutboxDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';

import { kTwilioOutboxType } from '@lib/database/Types';

/**
 * The outbox page summarises all outgoing SMS messages.
 */
export default async function OutboxSmsPage() {
    await requireAuthentication('system.internals.outbox');

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
            <Section tabs noHeader>
                <OutboxDataTable type={kTwilioOutboxType.SMS} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('SMS', 'Outbox', 'Communication');
