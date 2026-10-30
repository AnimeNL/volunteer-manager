// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';

import { executeAction } from '../../../../../../Action';
import { getSchedule, kGetScheduleDefinition } from '../../../getSchedule';

/**
 * Params accepted by this route implementation. Only the path exists, using NextJS dynamic routing.
 */
type Context = RouteContext<'/api/admin/event/schedule/[event]/[team]/[[...id]]'>;

/**
 * The GET /api/event/schedule endpoint can be used to retrieve existing schedule entries.
 */
export async function GET(request: NextRequest, { params }: Context) {
    return executeAction(request, kGetScheduleDefinition, getSchedule, await params);
}
