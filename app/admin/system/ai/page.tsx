// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Overview page for Artificial Intelligence, providing links to each section contained therein.
 */
export default async function ArtificialIntelligencePage() {
    return (
        <>
            <Section icon={ <AutoAwesomeIcon color="primary" /> } title="Artificial Intelligence"
                     breadcrumbs={[
                        { label: 'System', href: '/admin/system' },
                        { label: 'AI' },
                     ]}>
                <SectionIntroduction>
                    Artificial Intelligence capabilities are used for data analysis purposes and
                    scaling our communication services.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout />
        </>
    );
}
