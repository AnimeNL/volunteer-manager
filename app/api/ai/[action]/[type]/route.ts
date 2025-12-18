// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type NextRequest, NextResponse } from 'next/server';
import { executeAction } from '@app/api/Action';

import { generatePrompt, kGeneratePromptDefinition } from '../../generatePrompt';

/**
 * POST /api/ai/generate/:type
 */
export async function POST(request: NextRequest, context: RouteContext<'/api/ai/[action]/[type]'>) {
    const params = await context.params;
    switch (params.action) {
        case 'generate':
            return executeAction(request, kGeneratePromptDefinition, generatePrompt, params);
    }

    return NextResponse.json({ success: false }, { status: 404 });
}
