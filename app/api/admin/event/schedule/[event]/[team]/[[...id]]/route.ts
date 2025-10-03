// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../../../../Action';

import type { NextRouteParams } from '@lib/NextRouterParams';
import { createScheduleEntry, kCreateScheduleEntryDefinition } from '../../../createScheduleEntry';
import { deleteScheduleEntry, kDeleteScheduleEntryDefinition } from '../../../deleteScheduleEntry';
import { getSchedule, kGetScheduleDefinition } from '../../../getSchedule';
import { updateScheduleEntry, kUpdateScheduleEntryDefinition } from '../../../updateScheduleEntry';

/**
 * Params accepted by this route implementation. Only the path exists, using NextJS dynamic routing.
 */
type RouteParams = NextRouteParams<'event' | 'team', 'id'>;

/**
 * The DELETE /api/event/schedule endpoint can be used to delete existing schedule entries.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
    return executeAction(
        request, kDeleteScheduleEntryDefinition, deleteScheduleEntry, await params);
}

/**
 * The GET /api/event/schedule endpoint can be used to retrieve existing schedule entries.
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
    return executeAction(request, kGetScheduleDefinition, getSchedule, await params);
}

/**
 * The POST /api/event/schedule endpoint can be used to create new schedule entries.
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<Response> {
    return executeAction(
        request, kCreateScheduleEntryDefinition, createScheduleEntry, await params);
}

/**
 * The PUT /api/event/schedule endpoint can be used to create new schedule entries.
 */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<Response> {
    return executeAction(
        request, kUpdateScheduleEntryDefinition, updateScheduleEntry, await params);
}
