// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';

import { PlaceholderPage } from '../../components/PlaceholderPage';

/**
 * Placeholder location detail page for the schedule portal.
 */
export default function ScheduleLocationPage(
    props: PageProps<'/schedule2/[event]/locations/[id]'>)
{
    return (
        <PlaceholderPage
            description="Scheduled program events at this location."
            icon={ <PlaceOutlinedIcon /> }
            params={props.params}
            title="Location" />
    );
}

export const instant = true;
export const prefetch = 'partial';
