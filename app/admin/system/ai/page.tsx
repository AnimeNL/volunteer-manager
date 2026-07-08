// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Grid from '@mui/material/Grid';
import GroupsIcon from '@mui/icons-material/Groups';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import SmartToyIcon from '@mui/icons-material/SmartToy';

import { OverviewPageTile } from '../page';
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
            <Grid container spacing={2}>
                <OverviewPageTile Icon={ModelTrainingIcon} href="/admin/system/ai/models"
                                  label="Models" />
                <OverviewPageTile Icon={SmartToyIcon} href="/admin/system/ai/features"
                                  label="Features" />
                <OverviewPageTile Icon={QuestionAnswerOutlinedIcon}
                                  href="/admin/system/ai/communication" label="Communication" />
                <OverviewPageTile Icon={GroupsIcon} href="/admin/system/ai/nardo"
                                  label="Del a Rie Advies" />
            </Grid>
        </>
    );
}
