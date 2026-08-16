// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';

import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { KnowledgeBaseCategories } from './KnowledgeBaseCategories';
import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';
import { requireAuthentication } from '../requireAuthentication';

import { kThemeImageVersion } from '@app/config';

/**
 * The <ScheduleKnowledgePage> component displays a list of categories available in the knowledge
 * base, each of which links through to a page containing all associated questions.
 */
export default async function ScheduleKnowledgePage(
    props: PageProps<'/schedule/[event]/knowledge'>)
{
    await requireAuthentication(props);
    return (
        <>
            <HeaderSectionCard>
                <Box sx={{
                    backgroundImage: `url(/images/theme/knowledge-base.jpg?${kThemeImageVersion})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    width: '100%',
                    aspectRatio: 3.5 }} />
            </HeaderSectionCard>
            <KnowledgeBaseCategories />
        </>
    );
}

export const generateMetadata = generateScheduleMetadataFn([ 'Knowledge Base' ]);
