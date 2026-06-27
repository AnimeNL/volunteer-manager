// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';

import { executeAction } from '@app/api/Action';
import { scheduleTask, kScheduleTaskDefinition } from './scheduleTask';

/**
 * POST /api/admin/scheduler
 */
export async function POST(request: NextRequest): Promise<Response> {
    return executeAction(request, kScheduleTaskDefinition, scheduleTask);
}
