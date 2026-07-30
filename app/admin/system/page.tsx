// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import ApiIcon from '@mui/icons-material/Api';
import AppsIcon from '@mui/icons-material/Apps';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LoopIcon from '@mui/icons-material/Loop';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Overview page for the System pages. Displays a set of tiles that link through to the individual
 * sections. Made available to enable linkability in breadcrumbs.
 */
export default async function SystemPage() {
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

export const metadata: Metadata = {
    title: 'System | AnimeCon Volunteer Manager',
};
