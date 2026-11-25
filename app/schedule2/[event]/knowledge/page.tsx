// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Knowledge base page for the schedule portal.
 */
export default function ScheduleKnowledgePage(props: PageProps<'/schedule2/[event]/knowledge'>) {
    return (
        <PlaceholderPage
            description="Frequently asked questions and reference guides."
            icon={ <InfoOutlinedIcon /> }
            params={props.params}
            title="Knowledge base" />
    );
}

export const instant = true;
export const prefetch = 'partial';
