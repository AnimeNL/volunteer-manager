// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

const cookieStoreData = new Map<string, { value: string; options?: Record<string, unknown> }>();

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => {
            const entry = cookieStoreData.get(name);
            return entry ? { name, value: entry.value } : undefined;
        },
        set: (name: string, value: string, options?: Record<string, unknown>) => {
            cookieStoreData.set(name, { value, options });
        },
    }),
}));

import type { SessionData } from './Session';
import { getDisplayId, setDisplayId } from './DisplaySession';
import { getSessionFromCookieStore, kSessionCookieName, sealSession, unsealSession,
    writeEmptySessionCookieToStore, writeSealedSessionCookieToStore } from './Session';
import { sealToken } from './SealedToken';

describe('Session', () => {
    beforeEach(() => {
        cookieStoreData.clear();
    });

    it('should be able to seal and unseal sessions and reject invalid payloads', async () => {
        const persistentSession: SessionData = {
            sessionId: 77,
            userId: 9001,
            secret: 'random-per-device-secret',
        };

        const sealedPersistent = await sealSession(persistentSession);
        const unsealedPersistent = await unsealSession(sealedPersistent);
        expect(unsealedPersistent).toEqual(persistentSession);

        // Legacy { id, token } payloads are rejected even if sealed with the current key:
        const legacyPayload = sealToken(
            { id: 9001, token: 1234 }, 'session', process.env.APP_COOKIE_PASSWORD!, 3600);
        await expect(unsealSession(legacyPayload)).rejects.toThrow(/Invalid session payload/);
    });

    it('isolates user session cookies from display session cookies', async () => {
        const userSessionCookie = await sealSession({
            sessionId: 77,
            userId: 5,
            secret: 'secret',
        });

        cookieStoreData.set('display', { value: userSessionCookie });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await expect(getDisplayId()).resolves.toBeUndefined();
        } finally {
            consoleErrorSpy.mockRestore();
        }

        // Valid display cookies still roundtrip properly:
        await setDisplayId(17);
        expect(cookieStoreData.get('display')?.options?.httpOnly).toBe(true);
        expect(cookieStoreData.get('display')?.options?.sameSite).toBe('lax');
        await expect(getDisplayId()).resolves.toBe(17);
    });

    it('reads, writes, and clears HttpOnly SameSite=Lax session cookies', async () => {
        const stored: Record<string, { value: string; options: any }> = {};
        const cookieStore = {
            get: (name: string) => stored[name] ? { name, value: stored[name].value } : undefined,
            set: (name: string, value: string, options: any) => {
                stored[name] = { value, options };
            },
        } as any;

        const session: SessionData = { sessionId: 77, userId: 42, secret: 'secret' };
        await writeSealedSessionCookieToStore(session, cookieStore);

        expect(stored[kSessionCookieName].options.httpOnly).toBe(true);
        expect(stored[kSessionCookieName].options.maxAge).toBe(270 * 24 * 60 * 60);
        expect(stored[kSessionCookieName].options.sameSite).toBe('lax');
        expect(stored[kSessionCookieName].options.path).toBe('/');
        await expect(getSessionFromCookieStore(cookieStore)).resolves.toEqual(session);

        writeEmptySessionCookieToStore(cookieStore);
        expect(stored[kSessionCookieName].value).toBe('');
        expect(stored[kSessionCookieName].options.maxAge).toBe(0);
        await expect(getSessionFromCookieStore(cookieStore)).resolves.toBeUndefined();
    });
});
