// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SetRecordErrorLogDeferDelegate } from '@lib/ErrorLog';
import { buildAuthenticationContext } from '@lib/auth/AuthenticationTestHelpers';
import { useMockConnection } from '@lib/database/Connection';

import { activateAccount, anonymizeAccount, deactivateAccount, impersonate, resetPassword,
    updateAccountSuspension } from './AccountActions';

const mockCreatePasswordResetToken = vi.fn();
const mockImpersonateUser = vi.fn();
const mockInvalidateCache = vi.fn();
const mockRevokeAllUserSessions = vi.fn();

let currentAdminGrants = 'organisation.accounts,organisation.impersonation';

vi.mock('next/headers', () => ({
    headers: async () => new Headers({
        'host': 'animecon.team',
        'x-forwarded-for': '203.0.113.10',
    }),
}));

vi.mock('@lib/cache', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/cache')>();
    return {
        ...actual,
        invalidateCache: (...args: unknown[]) => mockInvalidateCache(...args),
    };
});

vi.mock('@lib/auth', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/auth')>();

    const buildAdminContext = () => buildAuthenticationContext({
        access: {
            grants: currentAdminGrants,
            events: '*',
            teams: '*',
        },
        user: {
            id: 42,
            firstName: 'Admin',
            lastName: 'User',
            name: 'Admin User',
            nameOrFirstName: 'Admin',
            username: 'admin@animecon.nl',
        },
    });

    return {
        ...actual,
        createPasswordResetToken: (...args: unknown[]) => mockCreatePasswordResetToken(...args),
        getAuthenticationContext: async () => buildAdminContext(),
        impersonateUser: (...args: unknown[]) => mockImpersonateUser(...args),
        requireAuthenticationContext: async () => buildAdminContext(),
        revokeAllUserSessions: (...args: unknown[]) => mockRevokeAllUserSessions(...args),
    };
});

vi.mock('@lib/log', () => ({
    LogBuilder: {
        for: () => {
            const builder = {
                withAffectedUser: () => builder,
                withCondition: () => builder,
                withInitiatorUser: () => builder,
                withSeverity: () => builder,
                record: vi.fn(),
            };
            return builder;
        },
    },
}));

describe('AccountActions - security & destructive operations', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        currentAdminGrants = 'organisation.accounts,organisation.impersonation';
        mockCreatePasswordResetToken.mockReset();
        mockImpersonateUser.mockReset();
        mockInvalidateCache.mockReset();
        mockRevokeAllUserSessions.mockReset();
        SetRecordErrorLogDeferDelegate(async () => undefined);
    });

    afterEach(() => {
        SetRecordErrorLogDeferDelegate(undefined);
    });

    it('blocks non-root administrators from managing, resetting, or impersonating root accounts', async () => {
        const rootTargetRow = {
            grants: 'root',
            revokes: null,
            events: '*',
            teams: '*',
        };

        for (const action of [
            () => activateAccount(99, {}),
            () => deactivateAccount(99, {}),
            () => anonymizeAccount(99, {}),
            () => impersonate(99, {}),
            () => resetPassword(99, {}),
            () => updateAccountSuspension(99, true, { reason: 'Misconduct' }),
        ]) {
            mockConnection.expect('selectOneRow', () => rootTargetRow);

            const result = await action();
            expect(result).toEqual({
                success: false,
                error: 'You are not allowed to manage a root account…',
            });
        }

        expect(mockImpersonateUser).not.toHaveBeenCalled();
        expect(mockCreatePasswordResetToken).not.toHaveBeenCalled();
        expect(mockRevokeAllUserSessions).not.toHaveBeenCalled();
    });

    it('allows root administrators to manage other root accounts without querying target access', async () => {
        currentAdminGrants = 'root';

        mockConnection.expect('update', () => 1);

        const result = await activateAccount(99, {});
        expect(result).toEqual({
            success: true,
            message: 'Their account has been activated',
            refresh: true,
        });
        expect(mockInvalidateCache).toHaveBeenCalledWith('user.auth', { userId: 99 });
    });

    it('refuses to anonymize protected accounts even for root administrators', async () => {
        currentAdminGrants = 'root';

        for (const protectedUserId of [ 1, 3, 4 ]) {
            const result = await anonymizeAccount(protectedUserId, {});
            expect(result).toEqual({
                success: false,
                error: 'This account is not allowed to be anonymized.',
            });
        }

        expect(mockRevokeAllUserSessions).not.toHaveBeenCalled();
        expect(mockInvalidateCache).not.toHaveBeenCalled();
    });

    it('anonymizes a non-root account inside a transaction and revokes sessions', async () => {
        // 1. Target access check (non-root target):
        mockConnection.expect('selectOneRow', () => ({
            grants: null,
            revokes: null,
            events: null,
            teams: null,
        }));

        // 2. Transaction: beginTransaction -> 3 updates -> 6 deletes -> commit:
        mockConnection.expect('beginTransaction');
        mockConnection.expect('update', () => 1);  // tUsers
        mockConnection.expect('update', () => 2);  // tOutboxEmail
        mockConnection.expect('update', () => 0);  // tFeedback (assigned)
        mockConnection.expect('delete', () => 0);  // tFeedback
        mockConnection.expect('delete', () => 0);  // tNardoPersonalised
        mockConnection.expect('delete', () => 1);  // tStorage
        mockConnection.expect('delete', () => 0);  // tSubscriptions
        mockConnection.expect('delete', () => 1);  // tUsersAuth
        mockConnection.expect('delete', () => 0);  // tUsersPasskeys
        mockConnection.expect('commit');

        const result = await anonymizeAccount(55, {});
        expect(result).toEqual({
            success: true,
            message: 'The account has been anonymized successfully',
            redirect: '/admin/organisation/accounts',
        });

        expect(mockRevokeAllUserSessions).toHaveBeenCalledWith(55);
        expect(mockInvalidateCache).toHaveBeenCalledWith('user.profile', { userId: 55 });
    });

    it('deactivates an account, revokes sessions, and invalidates auth cache', async () => {
        mockConnection.expect('selectOneRow', () => ({
            grants: null,
            revokes: null,
            events: null,
            teams: null,
        }));
        mockConnection.expect('update', () => 1);

        const result = await deactivateAccount(55, {});
        expect(result).toEqual({
            success: true,
            message: 'Their account has been deactivated',
            refresh: true,
        });

        expect(mockRevokeAllUserSessions).toHaveBeenCalledWith(55);
        expect(mockInvalidateCache).toHaveBeenCalledWith('user.auth', { userId: 55 });
    });

    it('impersonates a non-root user with audit context and redirects home', async () => {
        mockConnection.expect('selectOneRow', () => ({
            grants: null,
            revokes: null,
            events: null,
            teams: null,
        }));
        mockImpersonateUser.mockResolvedValueOnce({ id: 55, name: 'Volunteer' });

        const result = await impersonate(55, {});
        expect(result).toEqual({
            success: true,
            message: 'Impersonation successful. You are being redirected…',
            redirect: '/',
        });

        expect(mockImpersonateUser).toHaveBeenCalledWith(55, {
            impersonatorUserId: 42,
            returnUrl: '/admin/organisation/accounts/55',
            ip: '203.0.113.10',
        });
    });

    it('requires a reason when suspending an account and clears it when lifting suspension', async () => {
        mockConnection.expect('selectOneRow', () => ({
            grants: null,
            revokes: null,
            events: null,
            teams: null,
        }));

        const missingReason = await updateAccountSuspension(55, true, {});
        expect(missingReason).toEqual({
            success: false,
            error: 'A reason for the suspension must be given…',
        });

        mockConnection.expect('selectOneRow', () => ({
            grants: null,
            revokes: null,
            events: null,
            teams: null,
        }));
        mockConnection.expect('update', () => 1);

        const lifted = await updateAccountSuspension(55, false, {});
        expect(lifted).toEqual({ success: true, refresh: true });
    });
});
