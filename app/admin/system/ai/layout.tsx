// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import GroupsIcon from '@mui/icons-material/Groups';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import SmartToyIcon from '@mui/icons-material/SmartToy';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <ArtificialIntelligenceLayout> is the core layout through which different parts of our AI
 * settings are exposed in the administration area.
 */
export default async function ArtificialIntelligenceLayout(props: LayoutProps<'/admin/system/ai'>) {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: ModelTrainingIcon,
                label: 'Models',
                url: '/admin/system/ai/models',
                urlMatchMode: 'prefix',
            },
            {
                Icon: SmartToyIcon,
                label: 'Features',
                url: '/admin/system/ai/features',
                urlMatchMode: 'prefix',
            },
            {
                Icon: QuestionAnswerOutlinedIcon,
                label: 'Communication',
                url: '/admin/system/ai/communication',
                urlMatchMode: 'prefix',
            },
            {
                Icon: GroupsIcon,
                label: 'Del a Rie Advies',
                url: '/admin/system/ai/nardo',
                urlMatchMode: 'prefix',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
