// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { OverviewPage } from './OverviewPage';
import { generateScheduleMetadataFn } from './lib/generateScheduleMetadataFn';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';

/**
 * The <ScheduleMainPage> component contains the main page of the schedule, that shows an overview
 * of the things we'd like the volunteer to know about.
 */
export default async function ScheduleMainPage(props: PageProps<'/schedule/[event]'>) {
    await requireVolunteerAuthenticationWithEvent(props);

    return <OverviewPage />;
}

export const generateMetadata = generateScheduleMetadataFn([ 'Schedule' ]);
