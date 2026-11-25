// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Hotel room page for the schedule portal.
 */
export default function ScheduleHotelPage(props: PageProps<'/schedule2/[event]/hotel'>) {
    return (
        <PlaceholderPage
            description="Your assigned hotel room and weekend stay."
            icon={ <HotelOutlinedIcon /> }
            params={props.params}
            title="Hotel room" />
    );
}

export const instant = true;
export const prefetch = 'partial';
