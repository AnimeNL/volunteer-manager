// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import QueryStatsIcon from '@mui/icons-material/QueryStats';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';

/**
 * Overview page for the Diagnostics, providing links to each section contained therein.
 */
export default async function DiagnosticsPage() {
    return (
        <>
            <Section icon={ <QueryStatsIcon color="primary" /> } title="Diagnostics"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics' },
                     ]}>
                <SectionIntroduction>
                    Collection of pages that provide insight in the Volunteer Manager's behaviour.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout tiles={[
                {
                    Icon: LocationSearchingIcon,
                    href: '/admin/system/diagnostics/ip',
                    label: 'IP Addresses',
                },
            ]} />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Diagnostics', 'System');
