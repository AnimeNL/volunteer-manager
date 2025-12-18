// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../Action';

import { getSchedule, kPublicScheduleDefinition } from '../getSchedule';

/**
 * The /api/event/schedule endpoint can be used to acquire information about an event's schedule.
 */
export async function GET(
    request: NextRequest, context: RouteContext<'/api/event/schedule/[[...path]]'>)
{
    return executeAction(request, kPublicScheduleDefinition, getSchedule, await context.params);
}
