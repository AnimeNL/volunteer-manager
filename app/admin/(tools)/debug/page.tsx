// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { OverviewTiles } from '@app/admin/components/OverviewTiles';

/**
 * Page that lists the debugging tools available in the Volunteer Manager.
 */
export default async function DebugPage() {
    await requireAuthenticationContext({ check: 'admin', permission: 'root' });
    return (
        <>
            <Section icon={ <BugReportOutlinedIcon color="primary" /> } title="Debugging tools"
                     breadcrumbs={[
                         { label: 'Debug' },
                     ]}>
                <SectionIntroduction>
                    Internal tools hidden from discovery to try out specific functionality.
                </SectionIntroduction>
            </Section>
            <OverviewTiles tiles={[
                {
                    Icon: BuildOutlinedIcon,
                    label: 'Scheduler',
                    href: '/admin/debug/scheduler',
                }
            ]} />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Debug');
