// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../Action';

import { dutyBookMarkAsRead, kDutyBookMarkAsReadDefinition } from '../dutyBookMarkAsRead';

/**
 * The /api/event/schedule/duty-book endpoint can be used by volunteers mark a duty book event as
 * having been read.
 */
export async function PUT(request: NextRequest): Promise<Response> {
    return executeAction(request, kDutyBookMarkAsReadDefinition, dutyBookMarkAsRead);
}
