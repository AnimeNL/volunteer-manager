// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { createUserSession, hashSessionSecret, pruneExpiredSessions, revokeAllUserSessions,
    revokeUserSession, verifyUserSession } from './SessionStore';
import { useMockConnection } from '../database/Connection';

describe('SessionStore', () => {
    const mockConnection = useMockConnection();

    it('creates a session storing only the SHA-256 hash of the random secret', async () => {
        let insertedParams: any[] = [];

        mockConnection.expect('insertReturningLastInsertedId', (_query: string, params: any[]) => {
            insertedParams = params;
            return 77;
        });

        const created = await createUserSession({
            userId: 42,
            ip: '203.0.113.5',
            userAgent: 'TestAgent/1.0',
        });

        expect(created.sessionId).toBe(77);
        expect(created.userId).toBe(42);
        expect(created.secret.length).toBeGreaterThanOrEqual(40);
        expect(insertedParams).toContain(hashSessionSecret(created.secret));
        expect(insertedParams).not.toContain(created.secret);
    });

    it('verifies matching secrets and rejects mismatched or missing sessions', async () => {
        const secret = 'valid-random-session-secret-value';
        const storedHash = hashSessionSecret(secret);

        mockConnection.expect('selectOneRow', () => ({
            sessionId: 77,
            userId: 42,
            sessionTokenHash: storedHash,
            impersonatorUserId: 1,
            impersonatorReturnUrl: '/admin/organisation/accounts/42',
        }));

        await expect(verifyUserSession(77, secret)).resolves.toEqual({
            sessionId: 77,
            userId: 42,
            impersonatorUserId: 1,
            impersonatorReturnUrl: '/admin/organisation/accounts/42',
        });

        // Wrong secret fails constant-time comparison:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 77,
            userId: 42,
            sessionTokenHash: storedHash,
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));

        await expect(verifyUserSession(77, 'wrong-secret')).resolves.toBeUndefined();

        // Missing or expired row returns undefined:
        mockConnection.expect('selectOneRow', () => undefined);
        await expect(verifyUserSession(999, secret)).resolves.toBeUndefined();
    });

    it('revokes individual sessions, all user sessions, and expired sessions', async () => {
        mockConnection.expect('delete', () => 1);
        await revokeUserSession(77, 42);

        mockConnection.expect('delete', () => 3);
        await revokeAllUserSessions(42, 77);

        mockConnection.expect('delete', () => 5);
        await expect(pruneExpiredSessions()).resolves.toBe(5);
    });
});
