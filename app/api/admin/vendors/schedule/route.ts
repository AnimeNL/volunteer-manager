// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../Action';

import { updateVendorSchedule, kUpdateVendorScheduleDefinition } from '../updateVendorSchedule';

/**
 * The /api/admin/vendor/schedule endpoint can be used to update a vendor's schedule.
 */
export async function PUT(
    request: NextRequest, context: RouteContext<'/api/admin/vendors/schedule'>)
{
    return executeAction(
        request, kUpdateVendorScheduleDefinition, updateVendorSchedule, await context.params);
}
