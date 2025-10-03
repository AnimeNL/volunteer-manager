// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../Action';

import type { NextRouteParams } from '@lib/NextRouterParams';
import { getSchedule, kPublicScheduleDefinition } from '../getSchedule';

/**
 * The /api/event/schedule endpoint can be used to acquire information about an event's schedule.
 */
export async function GET(request: NextRequest, props: NextRouteParams<never, 'path'>)
    : Promise<Response>
{
    return executeAction(request, kPublicScheduleDefinition, getSchedule, await props.params);
}
