// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

export type { AuthenticationContext, UserAuthenticationContext, VisitorAuthenticationContext }
    from './AuthenticationContextTypes';
export type { PermissionAccessCheck, PermissionSet } from './access/PermissionCheck';
export type { User } from './User';

export { and, checkPermission, or } from './access/PermissionCheck';
export { clearAuthCache, executeAccessCheck, getAuthenticationContext,
    getAuthenticationContextFromHeaders, invalidateUserAuthCache, loadUserAuthenticationContext,
    requireAuthenticationContext } from './AuthenticationContext';
export { createAndWriteUserSessionCookie, pruneExpiredSessions, revokeAllUserSessions }
    from './SessionStore';
export { getDisplayIdFromCookieStore, writeDisplayIdToCookieStore } from './DisplaySession';
export { hashPassword } from './Password';
export { isUsernameAvailable } from './AccountStore';
export { normalizeClientIp } from './RateLimit';
export { sealPasswordResetRequest } from './PasswordReset';
