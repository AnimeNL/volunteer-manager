// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import CategoryIcon from '@mui/icons-material/Category';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';

/**
 * Configures the tabs to navigate between questions and categories.
 */
export default async function KnowledgeLayout(
    props: LayoutProps<'/admin/events/[event]/[team]/knowledge'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props);
    if (!team.flags.managesKnowledgeBase)
        notFound();

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: QuizOutlinedIcon,
                label: 'Questions',
                url: `/admin/events/${event.slug}/${team.slug}/knowledge`,
                urlMatchMode: 'strict',
            },
            {
                Icon: CategoryIcon,
                label: 'Categories',
                url: `/admin/events/${event.slug}/${team.slug}/knowledge/categories`,
                urlMatchMode: 'strict',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
