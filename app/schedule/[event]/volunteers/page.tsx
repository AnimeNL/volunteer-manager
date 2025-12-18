// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { VolunteerListPage } from './VolunteerListPage';
import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';

/**
 * The <ScheduleVolunteersPage> component display a page containing the volunteers that participate
 * in the current event, _and_ are accessible to the signed in volunteer. Information is exclusively
 * sourced from the context, thus no additional authentication is performed here.
 */
export default async function ScheduleVolunteersPage(
    props: PageProps<'/schedule/[event]/volunteers'>)
{
    return <VolunteerListPage />;
}

export const generateMetadata = generateScheduleMetadataFn([ 'Volunteers' ]);
