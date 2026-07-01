// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <DiagnosticsLayout> is the core layout through which different log types will be made
 * available in the administration section. This includes performance information.
 */
export default async function DiagnosticsLayout(props: LayoutProps<'/admin/system/diagnostics'>) {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: ReportGmailerrorredIcon,
                label: 'Error logs',
                url: '/admin/system/diagnostics/errors',
                urlMatchMode: 'prefix',
            },
            {
                Icon: InfoOutlinedIcon,
                label: 'System logs',
                url: '/admin/system/diagnostics/logs',
                urlMatchMode: 'prefix',
            }
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
