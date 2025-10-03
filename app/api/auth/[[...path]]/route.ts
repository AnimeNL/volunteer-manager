// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type NextRequest, NextResponse } from 'next/server';
import { executeAction } from '../../Action';

import type { NextRouteParams } from '@lib/NextRouterParams';
import { confirmIdentity, kConfirmIdentityDefinition } from '../confirmIdentity';
import { passwordChange, kPasswordChangeDefinition } from '../passwordChange';
import { passwordReset, kPasswordResetDefinition } from '../passwordReset';
import { passwordResetRequest, kPasswordResetRequestDefinition } from '../passwordResetRequest';
import { passwordResetVerify, kPasswordResetVerifyDefinition } from '../passwordResetVerify';
import { register, kRegisterDefinition } from '../register';
import { registerActivate, kRegisterActivateDefinition } from '../registerActivate';
import { settings, kSettingsDefinition } from '../settings';
import { signInPasskey, kSignInPasskeyDefinition } from '../signInPasskey';
import { signInPassword, kSignInPasswordDefinition } from '../signInPassword';
import { signInPasswordUpdate, kSignInPasswordUpdateDefinition } from '../signInPasswordUpdate';
import { signOut, kSignOutDefinition } from '../signOut';
import { updateAccount, kUpdateAccountDefinition } from '../updateAccount';
import { updateAvatar, kUpdateAvatarDefinition } from '../updateAvatar';

/**
 * The /api/auth endpoint exposes the API for providing user authentication and associated
 * functionality, including registration, password reset and so on.
 */
export async function POST(request: NextRequest, props: NextRouteParams<never, 'path'>)
    : Promise<Response>
{
    const params = await props.params;
    const action = Object.hasOwn(params, 'path') ? params.path!.join('/') : null;
    switch (action) {
        case 'confirm-identity':
            return executeAction(request, kConfirmIdentityDefinition, confirmIdentity);
        case 'password-change':
            return executeAction(request, kPasswordChangeDefinition, passwordChange);
        case 'password-reset':
            return executeAction(request, kPasswordResetDefinition, passwordReset);
        case 'password-reset-request':
            return executeAction(request, kPasswordResetRequestDefinition, passwordResetRequest);
        case 'password-reset-verify':
            return executeAction(request, kPasswordResetVerifyDefinition, passwordResetVerify);
        case 'register':
            return executeAction(request, kRegisterDefinition, register);
        case 'register-activate':
            return executeAction(request, kRegisterActivateDefinition, registerActivate);
        case 'settings':
            return executeAction(request, kSettingsDefinition, settings);
        case 'sign-in-passkey':
            return executeAction(request, kSignInPasskeyDefinition, signInPasskey);
        case 'sign-in-password':
            return executeAction(request, kSignInPasswordDefinition, signInPassword);
        case 'sign-in-password-update':
            return executeAction(request, kSignInPasswordUpdateDefinition, signInPasswordUpdate);
        case 'sign-out':
            return executeAction(request, kSignOutDefinition, signOut);
        case 'update-account':
            return executeAction(request, kUpdateAccountDefinition, updateAccount);
        case 'update-avatar':
            return executeAction(request, kUpdateAvatarDefinition, updateAvatar);
    }

    return NextResponse.json({ success: false }, { status: 404 });
}
