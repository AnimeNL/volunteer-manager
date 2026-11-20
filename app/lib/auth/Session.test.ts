// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import type { SessionData } from './Session';
import { getDisplayIdFromCookieStore, writeDisplayIdToCookieStore } from './DisplaySession';
import {
    isPersistentSessionData,
    sealSession,
    unsealSession,
    writeSealedSessionCookie,
} from './Session';
import { isSealedToken } from './SealedToken';
import { seal } from './Iron';

describe('Session', () => {
    it('should be able to seal and unseal sessions', async () => {
        const plaintextSession: SessionData = {
            id: 9001,
            token: 1234,
        };

        const sealedSession = await sealSession(plaintextSession);
        expect(isSealedToken(sealedSession)).toBeTruthy();

        const unsealedSession = await unsealSession(sealedSession);
        expect(unsealedSession).toEqual(plaintextSession);
        expect(isPersistentSessionData(unsealedSession)).toBe(false);

        const persistentSession: SessionData = {
            sessionId: 77,
            userId: 9001,
            secret: 'random-per-device-secret',
        };

        const sealedPersistent = await sealSession(persistentSession);
        const unsealedPersistent = await unsealSession(sealedPersistent);
        expect(unsealedPersistent).toEqual(persistentSession);
        expect(isPersistentSessionData(unsealedPersistent)).toBe(true);
    });

    it('continues to unseal legacy Iron-sealed session cookies', async () => {
        const plaintextSession: SessionData = { id: 42, token: 77 };
        const legacySession = await seal(plaintextSession, process.env.APP_COOKIE_PASSWORD!, 3600);

        expect(isSealedToken(legacySession)).toBeFalsy();
        await expect(unsealSession(legacySession)).resolves.toEqual(plaintextSession);
    });

    it('isolates user session cookies from display session cookies', async () => {
        const userSessionCookie = await sealSession({ id: 5, token: 123 });
        const legacyUserSessionCookie = await seal(
            { id: 5, token: 123 }, process.env.APP_COOKIE_PASSWORD!, 3600);

        const makeCookieStore = (value: string) => ({
            get: (name: string) => name === 'display' ? { name, value } : undefined,
            set: () => {},
        }) as any;

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await expect(getDisplayIdFromCookieStore(makeCookieStore(userSessionCookie)))
                .resolves.toBeUndefined();
            await expect(getDisplayIdFromCookieStore(makeCookieStore(legacyUserSessionCookie)))
                .resolves.toBeUndefined();
        } finally {
            consoleErrorSpy.mockRestore();
        }

        // Valid display cookies still roundtrip properly:
        const stored: Record<string, { value: string; options: any }> = {};
        const writableStore = {
            get: (name: string) => stored[name] ? { name, value: stored[name].value } : undefined,
            set: (name: string, value: string, options: any) => {
                stored[name] = { value, options };
            },
        } as any;

        await writeDisplayIdToCookieStore(writableStore, 17);
        expect(stored.display.options.httpOnly).toBe(true);
        expect(stored.display.options.sameSite).toBe('lax');
        await expect(getDisplayIdFromCookieStore(writableStore)).resolves.toBe(17);
    });

    it('sets HttpOnly and SameSite=Lax on written session cookies', async () => {
        const headers = new Headers();
        await writeSealedSessionCookie({ id: 42, token: 9001 }, headers);

        const setCookie = headers.get('Set-Cookie') ?? '';
        expect(setCookie).toContain('HttpOnly');
        expect(setCookie).toContain('SameSite=Lax');
        expect(setCookie).toContain('Path=/');
    });
});
