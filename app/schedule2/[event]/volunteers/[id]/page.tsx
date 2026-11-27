// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';

import { PlaceholderPage } from '../../components/PlaceholderPage';
import { createScheduleMetadataFn } from '../../lib/generateScheduleMetadata';

/**
 * Placeholder volunteer detail page for the schedule portal.
 */
export default function ScheduleVolunteerPage(
    props: PageProps<'/schedule2/[event]/volunteers/[id]'>)
{
    return (
        <PlaceholderPage
            description="Profile, shifts, and contact details for this volunteer."
            icon={ <GroupOutlinedIcon /> }
            params={props.params}
            title="Volunteers" />
    );
}

export const generateMetadata = createScheduleMetadataFn('Volunteers', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
