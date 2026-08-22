// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import { OverviewTiles } from '@app/admin/components/OverviewTiles';

/**
 * Page that lists the debugging tools available in the Volunteer Manager.
 */
export default async function DebugPage() {
    await requireAuthentication('admin');
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
                    Icon: PodcastsIcon,
                    label: 'Communication',
                    href: '/admin/debug/communication',
                },
                {
                    Icon: ReportOutlinedIcon,
                    label: 'HTTP 401 Unauthorized',
                    href: '/admin/debug/unauthorized',
                },
                {
                    Icon: ReportOutlinedIcon,
                    label: 'HTTP 403 Forbidden',
                    href: '/admin/debug/forbidden',
                },
                {
                    Icon: ReportOutlinedIcon,
                    label: 'HTTP 404 Not Found',
                    href: '/admin/debug/not-found',
                },
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
