// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { executeAction } from '../../../Action';

import { submitFeedback, kSubmitFeedbackDefinition } from '../submitFeedback';

/**
 * The /api/event/schedule/feedback endpoint can be used by volunteers to submit feedback.
 */
export async function POST(request: NextRequest): Promise<Response> {
    return executeAction(request, kSubmitFeedbackDefinition, submitFeedback);
}
