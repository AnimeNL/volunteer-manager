// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Page through which administrators are able to manage message formatting, i.e. how log entries
 * should be presented on the log overview page. Restricted to administrators as this is relatively
 * easy to mess up.
 */
export default async function SystemLogsMessageFormattingPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.settings',
    });

    // TODO: Ability to hide log messages from the interface
    // TODO: Editable <DataTable>

    return (
        <>
            <Section icon={ <ReceiptOutlinedIcon color="primary" /> } title="Message formatting"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'System logs', href: '/admin/system/diagnostics/logs' },
                         { label: 'Message formatting' },
                     ]}>
                <SectionIntroduction>
                    Log messages and the formatting rules through which they should be presented.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                todo
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Messages | System logs | AnimeCon Volunteer Manager',
};
