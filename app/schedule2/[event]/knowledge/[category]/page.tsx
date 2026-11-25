// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { PlaceholderPage } from '../../components/PlaceholderPage';

/**
 * Placeholder Knowledge base category page for the schedule portal.
 */
export default function ScheduleKnowledgeCategoryPage(
    props: PageProps<'/schedule2/[event]/knowledge/[category]'>)
{
    return (
        <PlaceholderPage
            description="Questions and reference guides in this category."
            icon={ <InfoOutlinedIcon /> }
            params={props.params}
            title="Knowledge base" />
    );
}

export const instant = true;
export const prefetch = 'partial';
