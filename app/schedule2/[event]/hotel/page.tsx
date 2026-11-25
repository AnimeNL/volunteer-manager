// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Hotel room page for the schedule portal.
 */
export default function ScheduleHotelPage(props: PageProps<'/schedule2/[event]/hotel'>) {
    return <PlaceholderPage params={props.params} title="Hotel room" />;
}

export const instant = true;
export const prefetch = 'partial';
