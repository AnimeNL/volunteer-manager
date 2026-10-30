// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AppsIcon from '@mui/icons-material/Apps';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import StreamIcon from '@mui/icons-material/Stream';
import WebhookIcon from '@mui/icons-material/Webhook';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { or, requireAuthentication } from '@lib/requireAuthentication';

/**
 * Overview page for the Communication pages. Displays a set of tiles that link through to the
 * individual sections. Made available to enable linkability in breadcrumbs.
 */
export default async function CommunicationPage() {
    await requireAuthentication(or(
        'system.internals.outbox',
        'system.subscriptions.management',
    ));

    return (
        <>
            <Section icon={ <AppsIcon color="primary" /> } title="Communication"
                     breadcrumbs={[
                         { label: 'Communication' },
                     ]}>
                <SectionIntroduction>
                    Collection of pages that provide insight to communication driven via the
                    Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <OverviewTiles tiles={[
                {
                    Icon: OutboxOutlinedIcon,
                    href: '/admin/system/outbox/email',
                    label: 'Outbox',
                },
                {
                    Icon: StreamIcon,
                    href: '/admin/system/subscriptions',
                    label: 'Subscriptions',
                },
                {
                    Icon: WebhookIcon,
                    href: '/admin/system/webhooks',
                    label: 'Webhooks',
                },
            ]} />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Communication', 'System');
