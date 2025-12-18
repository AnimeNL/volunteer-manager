// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type NextRequest, NextResponse } from 'next/server';
import { executeAction } from '@app/api/Action';

import { updateSettings, kUpdateAiSettingsDefinition } from '../updateSettings';

/**
 * PUT /api/ai/settings
 */
export async function PUT(request: NextRequest, context: RouteContext<'/api/ai/[action]'>) {
    const params = await context.params;

    switch (params.action) {
        case 'settings':
            return executeAction(request, kUpdateAiSettingsDefinition, updateSettings);
    }

    return NextResponse.json({ success: false }, { status: 404 });
}
