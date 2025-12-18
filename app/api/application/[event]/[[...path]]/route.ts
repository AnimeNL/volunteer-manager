// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type NextRequest, NextResponse } from 'next/server';
import { executeAction } from '@app/api/Action';

import { updateApplication, kUpdateApplicationDefinition } from '../../updateApplication';

/**
 * Params accepted by this route implementation. Only the path exists, using NextJS dynamic routing.
 */
type Context = RouteContext<'/api/application/[event]/[[...path]]'>;

/**
 * PUT /api/application/:event/:team/:userId
 */
export async function PUT(request: NextRequest, context: Context) {
    const params = await context.params;

    if (params.path!.length === 2) {
        return executeAction(request, kUpdateApplicationDefinition, updateApplication, {
            event: params.event,
            team: params.path![0],
            userId: params.path![1],
        });
    }

    return NextResponse.json({ success: false }, { status: 404 });
}
