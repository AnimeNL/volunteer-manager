// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ProgramHistory } from '../ProgramHistory';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

export default async function ProgramActivitiesHistorySlot(
    props: PageProps<'/admin/events/[event]/program/activities'>)
{
    const authenticationContext = await requireAuthenticationContext();

    const params = await props.params;
    return <ProgramHistory authenticationContext={authenticationContext}
                           context={{
                               event: params.event,
                               scope: { category: 'activities' },
                           }} />;
}
