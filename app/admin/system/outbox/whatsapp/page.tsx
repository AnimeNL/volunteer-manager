// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { OutboxDataTable } from '../OutboxDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';

import { kTwilioOutboxType } from '@lib/database/Types';

/**
 * The outbox page summarises all outgoing WhatsApp messages. This includes both human readable
 * messages, as well as reactions such as an emoji response.
 */
export default async function OutboxWhatsAppPage() {
    await requireAuthentication('system.internals.outbox');

    return (
        <>
            <Section icon={ <WhatsAppIcon color="primary" /> } title="WhatsApp outbox"
                     breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Outbox', href: '/admin/system/outbox' },
                         { label: 'WhatsApp' },
                     ]}>
                <SectionIntroduction>
                    These are WhatsApp messages that were sent through the portal.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <OutboxDataTable type={kTwilioOutboxType.WhatsApp} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('WhatsApp', 'Outbox', 'Communication');
