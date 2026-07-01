// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';

import { LogsDataTable } from './LogsDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionTabs } from '@app/admin/components/SectionTabs';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The logs page provides access to the most recent log entries created by the Volunteer Manager,
 * with a variety of filtering options available. All log entries are made accessible to the client,
 * however they will be streamed by the server to deal with ~infinitely large data sets.
 */
export default async function SystemLogsPage() {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    return (
        <>
            <Section icon={ <ReceiptOutlinedIcon color="primary" /> } title="System logs"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'System logs' },
                     ]}>
                <SectionIntroduction>
                    A chronologic record of actions committed within the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <SectionTabs />
                <LogsDataTable enableDelete={ access.can('system.logs', 'delete') } />
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'System logs | AnimeCon Volunteer Manager',
};
