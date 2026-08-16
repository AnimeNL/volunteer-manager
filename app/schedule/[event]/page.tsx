// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { OverviewPage } from './OverviewPage';
import { generateScheduleMetadataFn } from './lib/generateScheduleMetadataFn';
import { requireAuthentication } from './requireAuthentication';

/**
 * The <ScheduleMainPage> component contains the main page of the schedule, that shows an overview
 * of the things we'd like the volunteer to know about.
 */
export default async function ScheduleMainPage(props: PageProps<'/schedule/[event]'>) {
    await requireAuthentication(props);

    return <OverviewPage />;
}

export const generateMetadata = generateScheduleMetadataFn([ 'Schedule' ]);
