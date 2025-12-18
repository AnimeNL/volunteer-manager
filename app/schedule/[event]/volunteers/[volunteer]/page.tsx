// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { VolunteerPage } from './VolunteerPage';

/**
 * The <ScheduleVolunteerPage> component display a page for a particular volunteer, identified by
 * their unique user ID in the URL. Data is exclusively sourced from the context, thus no further
 * authentication will be performed.
 */
export default async function ScheduleVolunteerPage(
    props: PageProps<'/schedule/[event]/volunteers/[volunteer]'>)
{
    return <VolunteerPage userId={(await props.params).volunteer} />;
}
