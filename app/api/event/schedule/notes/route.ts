// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../Action';

import { updateNotes, kUpdateNotesDefinition } from '../updateNotes';

/**
 * The /api/event/schedule/notes endpoint can be used to update the notes of a particular volunteer.
 */
export async function PUT(request: NextRequest): Promise<Response> {
    return executeAction(request, kUpdateNotesDefinition, updateNotes);
}
