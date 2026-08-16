// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { Section } from '@app/admin/components/Section';
import { TwilioDetailsPage } from '../../TwilioDetailsPage';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';

import { kTwilioOutboxType } from '@lib/database/Types';

/**
 * The outbox page details an outgoing WhatsApp message, with all information we have collected in
 * the database regarding delivery of that message.
 */
export default async function OutboxWhatsAppDetailsPage(
    props: PageProps<'/admin/system/outbox/whatsapp/[id]'>)
{
    await requireAuthentication('system.internals.outbox');

    const params = await props.params;

    return (
        <>
            <Section icon={ <WhatsAppIcon color="primary" /> }
                     title={`WhatsApp message #${params.id}`}
                     breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Outbox', href: '/admin/system/outbox' },
                         { label: 'WhatsApp', href: '/admin/system/outbox/whatsapp' },
                         { label: `#${params.id}` },
                     ]}>
                <SectionIntroduction>
                    Detailed information about a message we sent through WhatsApp.
                </SectionIntroduction>
            </Section>
            <TwilioDetailsPage type={kTwilioOutboxType.WhatsApp} id={parseInt(params.id, 10)} />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id' }, 'WhatsApp', 'Outbox', 'Communication');
