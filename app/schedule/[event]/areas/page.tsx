// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AreaList } from './AreaList';
import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';

/**
 * The <ScheduleEventsPage> component displays an overview of the areas that are part of the
 * event's location, and the events that are active therein.  Authentication is skipped as this page
 * only consumes data already shared with the client.
 */
export default function ScheduleAreasPage(props: PageProps<'/schedule/[event]/areas'>) {
    return <AreaList />;
}

export const generateMetadata = generateScheduleMetadataFn([ 'Events' ]);
