// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../../components/PlaceholderPage';

/**
 * Placeholder area detail page for the schedule portal.
 */
export default function ScheduleAreaPage(props: PageProps<'/schedule2/[event]/areas/[area]'>) {
    return <PlaceholderPage params={props.params} title="Events" />;
}

export const instant = true;
export const prefetch = 'partial';
