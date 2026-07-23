// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from '@app/LinkProxy';

import FindReplaceIcon from '@mui/icons-material/FindReplace';
import IconButton from '@mui/material/IconButton';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import Tooltip from '@mui/material/Tooltip';

import { LogsDataTable } from './LogsDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionTabs } from '@app/admin/components/SectionTabs';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';
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

    let headerAction: React.ReactNode;
    if (access.can('system.internals.settings')) {
        headerAction = (
            <IconButton component={Link} href="./logs/messages" size="small">
                <Tooltip title="Message formatting…">
                    <TooltipIconWrapper>
                        <FindReplaceIcon color="action" fontSize="small" />
                    </TooltipIconWrapper>
                </Tooltip>
            </IconButton>
        );
    }

    return (
        <>
            <Section icon={ <ReceiptOutlinedIcon color="primary" /> } title="System logs"
                     headerAction={headerAction} breadcrumbs={[
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
                <LogsDataTable />
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'System logs | AnimeCon Volunteer Manager',
};
