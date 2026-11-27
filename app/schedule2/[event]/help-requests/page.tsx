// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import NotListedLocationOutlinedIcon from '@mui/icons-material/NotListedLocationOutlined';

import { PlaceholderPage } from '../components/PlaceholderPage';
import { createScheduleMetadataFn } from '../lib/generateScheduleMetadata';

/**
 * Placeholder Help requests page for the schedule portal.
 */
export default function ScheduleHelpRequestsPage(
    props: PageProps<'/schedule2/[event]/help-requests'>)
{
    return (
        <PlaceholderPage
            description="Active requests for assistance across the venue."
            icon={ <NotListedLocationOutlinedIcon /> }
            params={props.params}
            permission="event.help-requests"
            title="Help requests" />
    );
}

export const generateMetadata = createScheduleMetadataFn('Help requests', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
