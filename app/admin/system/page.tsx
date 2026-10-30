// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import ApiIcon from '@mui/icons-material/Api';
import AppsIcon from '@mui/icons-material/Apps';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';
import LoopIcon from '@mui/icons-material/Loop';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import StorageIcon from '@mui/icons-material/Storage';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '../lib/generatePageMetadata';
import { or, requireAuthentication } from '@lib/requireAuthentication';

/**
 * Overview page for the System pages. Displays a set of tiles that link through to the individual
 * sections. Made available to enable linkability in breadcrumbs.
 */
export default async function SystemPage() {
    await requireAuthentication(or(
        'system.integrations',
        'system.internals.ai',
        'system.internals.cache',
        'system.internals.debug',
        'system.internals.scheduler',
        'system.internals.settings',
        {
            permission: 'system.logs',
            operation: 'read',
        },
        'system.permissions',
    ));

    return (
        <>
            <Section icon={ <AppsIcon color="primary" /> } title="System"
                     breadcrumbs={[ { label: 'System' }]}>
                <SectionIntroduction>
                    Collection of pages that either control or provide insight into the behaviour of
                    the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <OverviewTiles tiles={[
                {
                    Icon: AutoAwesomeIcon,
                    href: '/admin/system/ai/communication',
                    label: 'AI',
                },
                {
                    Icon: FolderCopyOutlinedIcon,
                    href: '/admin/system/cache',
                    label: 'Cache',
                },
                {
                    Icon: StorageIcon,
                    href: '/admin/system/database',
                    label: 'Database',
                },
                {
                    Icon: QueryStatsIcon,
                    href: '/admin/system/diagnostics/logs',
                    label: 'Diagnostics',
                },
                {
                    Icon: ApiIcon,
                    href: '/admin/system/integrations',
                    label: 'Integrations',
                },
                {
                    Icon: AdminPanelSettingsOutlinedIcon,
                    href: '/admin/system/permissions/principals',
                    label: 'Permissions',
                },
                {
                    Icon: LoopIcon,
                    href: '/admin/system/scheduler',
                    label: 'Scheduler',
                },
                {
                    Icon: SettingsOutlinedIcon,
                    href: '/admin/system/settings',
                    label: 'Settings',
                },
            ]} />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('System');
