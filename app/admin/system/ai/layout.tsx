// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import GroupsIcon from '@mui/icons-material/Groups';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import Paper from '@mui/material/Paper';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';

import { NavigationTabs, type NavigationTabsProps } from '@app/admin/components/NavigationTabs';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <ArtificialIntelligenceLayout> is the core layout through which different parts of our AI
 * settings are exposed in the administration area.
 */
export default async function ArtificialIntelligenceLayout(props: React.PropsWithChildren) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const tabs: NavigationTabsProps['tabs'] = [
        {
            icon: <QuestionAnswerOutlinedIcon />,
            label: 'Dump',
            url: '/admin/system/ai',
        },
        {
            icon: <ModelTrainingIcon />,
            label: 'Models',
            url: '/admin/system/ai/models',
            urlMatchMode: 'prefix',
        },
        {
            icon: <QuestionAnswerOutlinedIcon />,
            label: 'Communication',
            url: '/admin/system/ai/communication',
            urlMatchMode: 'prefix',
        },
        {
            icon: <GroupsIcon />,
            label: 'Del a Rie Advies',
            url: '/admin/system/ai/nardo',
            urlMatchMode: 'prefix',
        },
    ];

    return (
        <>
            <Section icon={ <AutoAwesomeIcon color="primary" /> } title="Artificial Intelligence"
                     documentation="system/ai">
                <SectionIntroduction>
                    Artificial Intelligence capabilities are used for data analysis purposes,
                    scaling our communication and Del a Rie Advies' services.
                </SectionIntroduction>
            </Section>
            <Paper>
                <NavigationTabs tabs={tabs} />
                <Divider />
                <Box sx={{ p: 2 }}>
                    {props.children}
                </Box>
            </Paper>
        </>
    );
}
