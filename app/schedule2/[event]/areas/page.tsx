// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder program areas page for the schedule portal.
 */
export default function ScheduleAreasPage(props: PageProps<'/schedule2/[event]/areas'>) {
    return (
        <PlaceholderPage
            description="Browse festival areas and scheduled program events."
            icon={ <EventNoteOutlinedIcon /> }
            params={props.params}
            title="Events" />
    );
}

export const instant = true;
export const prefetch = 'partial';
