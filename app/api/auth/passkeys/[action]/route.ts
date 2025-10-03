// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type NextRequest, NextResponse } from 'next/server';
import { executeAction } from '../../../Action';

import type { NextRouteParams } from '@lib/NextRouterParams';
import { createChallenge, kCreateChallengeDefinition } from '../createChallenge';
import { deletePasskey, kDeletePasskeyDefinition } from '../deletePasskey';
import { listPasskeys, kListPasskeysDefinition } from '../listPasskeys';
import { registerPasskey, kRegisterPasskeyDefinition } from '../registerPasskey';

/**
 * Params accepted by this route implementation. Only the path exists, using NextJS dynamic routing.
 */
type RouteParams = NextRouteParams<'action'>;

/**
 * The /api/auth/passkeys endpoint exposes the ability for a user to manage their passkeys.
 */
export async function DELETE(request: NextRequest, props: RouteParams): Promise<Response> {
    const params = await props.params;
    const action = Object.hasOwn(params, 'action') ? params.action : null;
    switch (action) {
        case 'delete':
            return executeAction(request, kDeletePasskeyDefinition, deletePasskey);
    }

    return NextResponse.json({ success: false }, { status: 404 });
}

/**
 * The /api/auth/passkeys endpoint exposes the ability for a user to manage their passkeys.
 */
export async function GET(request: NextRequest, props: RouteParams): Promise<Response> {
    const params = await props.params;
    const action = Object.hasOwn(params, 'action') ? params.action : null;
    switch (action) {
        case 'list':
            return executeAction(request, kListPasskeysDefinition, listPasskeys);
    }

    return NextResponse.json({ success: false }, { status: 404 });
}

/**
 * The /api/auth/passkeys endpoint exposes the ability for a user to manage their passkeys.
 */
export async function POST(request: NextRequest, props: RouteParams): Promise<Response> {
    const params = await props.params;
    const action = Object.hasOwn(params, 'action') ? params.action : null;
    switch (action) {
        case 'create-challenge':
            return executeAction(request, kCreateChallengeDefinition, createChallenge);
        case 'register':
            return executeAction(request, kRegisterPasskeyDefinition, registerPasskey);
    }

    return NextResponse.json({ success: false }, { status: 404 });
}
