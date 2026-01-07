// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import DvrIcon from '@mui/icons-material/Dvr';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import Paper from '@mui/material/Paper';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';

import { NavigationTabs, type NavigationTabsProps } from '@app/admin/components/NavigationTabs';
import { SectionHeader } from '@app/admin/components/SectionHeader';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <DiagnosticsLayout> is the core layout through which different log types will be made
 * available in the administration section. This includes performance information.
 */
export default async function DiagnosticsLayout(props: LayoutProps<'/admin/system/diagnostics'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    const tabs: NavigationTabsProps['tabs'] = [
        {
            icon: <ReportGmailerrorredIcon color="error" />,
            label: 'Error logs',
            url: '/admin/system/diagnostics/errors',
            urlMatchMode: 'prefix',
        },
        // TODO: Performance?
        {
            icon: <InfoOutlineIcon color="info" />,
            label: 'System logs',
            url: '/admin/system/diagnostics/logs',
        },
    ];

    return (
        <Paper>
            <SectionHeader icon={ <DvrIcon color="primary" /> } title="Diagnostics" sx={{ m: 2 }} />
            <Divider sx={{ mt: 3 }} />
            <NavigationTabs tabs={tabs} />
            <Divider />
            <Box sx={{ p: 2 }}>
                {props.children}
            </Box>
        </Paper>
    );
}
