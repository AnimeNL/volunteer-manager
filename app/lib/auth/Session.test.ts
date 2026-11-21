// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import type { SessionData } from './Session';
import { getDisplayIdFromCookieStore, writeDisplayIdToCookieStore } from './DisplaySession';
import { sealSession, unsealSession, writeSealedSessionCookie } from './Session';
import { sealToken } from './SealedToken';

describe('Session', () => {
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

        const makeCookieStore = (value: string) => ({
            get: (name: string) => name === 'display' ? { name, value } : undefined,
            set: () => {},
        }) as any;

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await expect(getDisplayIdFromCookieStore(makeCookieStore(userSessionCookie)))
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
        await writeSealedSessionCookie(
            { sessionId: 77, userId: 42, secret: 'secret' }, headers);

        const setCookie = headers.get('Set-Cookie') ?? '';
        expect(setCookie).toContain('HttpOnly');
        expect(setCookie).toContain('SameSite=Lax');
        expect(setCookie).toContain('Path=/');
    });
});
