// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EmailIcon from '@mui/icons-material/Email';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Page that demonstrates some of Weeztix' APIs, primarily to test the implementation and provide
 * quick insight in values (such as event GUIDs) that may be repeatedly needed.
 */
export default async function EmailIntegrationPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.settings',
    });

    return (
        <>
            <Section icon={ <EmailIcon color="primary" /> } title="E-mail accounts"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations', href: '/admin/system/integrations' },
                         { label: 'E-mail accounts' },
                     ]}>
                <SectionIntroduction>
                    The Volunteer Manager supports multiple e-mail accounts for outbound messaging.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                { /* TODO: DataTable */ }
            </Section>
            <Section icon={ <SettingsEthernetIcon /> } title="Connection check">
                <SectionIntroduction>
                    A connection check will help validate that all account details are still valid.
                </SectionIntroduction>
                { /* TODO */ }
            </Section>
        </>
    );
}
