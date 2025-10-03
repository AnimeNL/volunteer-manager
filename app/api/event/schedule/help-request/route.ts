// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../Action';

import { updateHelpRequest, kUpdateHelpRequestDefinition } from '../updateHelpRequest';

/**
 * The /api/event/schedule/help-request endpoint can be used to update the state of a particular
 * help request. Only PUT requests to update an existing help request are supported.
 */
export async function PUT(request: NextRequest): Promise<Response> {
    return executeAction(request, kUpdateHelpRequestDefinition, updateHelpRequest);
}
