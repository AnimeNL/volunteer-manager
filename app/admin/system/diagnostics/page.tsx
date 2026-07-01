// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Grid from '@mui/material/Grid';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import QueryStatsIcon from '@mui/icons-material/QueryStats';

import { OverviewPageTile } from '../page';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

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
                    Collection of pages that provide insight to messages sent through the portal.
                </SectionIntroduction>
            </Section>
            <Grid container spacing={2}>
                <OverviewPageTile Icon={ReportGmailerrorredIcon}
                                  href="/admin/system/diagnostics/errors" label="Error logs" />
                <OverviewPageTile Icon={InfoOutlinedIcon} href="/admin/system/diagnostics/logs"
                                  label="System logs" />
            </Grid>
        </>
    );
}
