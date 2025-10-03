// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../Action';

import { updateFavourite, kUpdateFavouriteDefinition } from '../updateFavourite';

/**
 * The /api/event/schedule/favourite endpoint can be used by volunteers to favourite events.
 */
export async function PUT(request: NextRequest): Promise<Response> {
    return executeAction(request, kUpdateFavouriteDefinition, updateFavourite);
}
