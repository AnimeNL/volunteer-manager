// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import {
    consumePasskeyChallengeCookie,
    writePasskeyChallengeCookie,
} from './PasskeyChallenge';

describe('PasskeyChallenge', () => {
    function createMockCookieStore() {
        const store = new Map<string, { value: string; options: any }>();
        return {
            store,
            get: (name: string) => {
                const entry = store.get(name);
                return entry ? { name, value: entry.value } : undefined;
            },
            set: (name: string, value: string, options: any) => {
                store.set(name, { value, options });
            },
        } as any;
    }

    afterEach(() => {
        vi.useRealTimers();
    });

    it('writes a sealed HttpOnly cookie and consumes it once for matching metadata', () => {
        const cookieStore = createMockCookieStore();

        writePasskeyChallengeCookie(cookieStore, {
            challenge: 'random-challenge-123',
            flow: 'authenticate',
            rpId: 'animecon.team',
            userId: 42,
        });

        const stored = cookieStore.store.get('passkey_challenge');
        expect(stored.options.httpOnly).toBe(true);
        expect(stored.options.sameSite).toBe('lax');
        expect(stored.options.maxAge).toBe(300);

        const challenge = consumePasskeyChallengeCookie(cookieStore, {
            flow: 'authenticate',
            rpId: 'animecon.team',
            userId: 42,
        });

        expect(challenge).toBe('random-challenge-123');
        expect(cookieStore.store.get('passkey_challenge').value).toBe('');
        expect(cookieStore.store.get('passkey_challenge').options.maxAge).toBe(0);

        // Consuming a second time returns undefined (single-use):
        expect(consumePasskeyChallengeCookie(cookieStore, {
            flow: 'authenticate',
            rpId: 'animecon.team',
            userId: 42,
        })).toBeUndefined();
    });

    it('rejects challenges bound to a different flow, rpId, or userId', () => {
        const payload = {
            challenge: 'secret-challenge',
            flow: 'register' as const,
            rpId: 'animecon.team',
            userId: 42,
        };

        for (const mismatch of [
            { flow: 'authenticate' as const, rpId: 'animecon.team', userId: 42 },
            { flow: 'register' as const, rpId: 'stewards.team', userId: 42 },
            { flow: 'register' as const, rpId: 'animecon.team', userId: 99 },
        ]) {
            const cookieStore = createMockCookieStore();
            writePasskeyChallengeCookie(cookieStore, payload);
            expect(consumePasskeyChallengeCookie(cookieStore, mismatch)).toBeUndefined();
        }
    });

    it('rejects expired and corrupted challenge cookies', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

        const cookieStore = createMockCookieStore();
        writePasskeyChallengeCookie(cookieStore, {
            challenge: 'expiring-challenge',
            flow: 'authenticate',
            rpId: 'animecon.team',
            userId: 42,
        });

        vi.advanceTimersByTime(5 * 60_000 + 1000);
        expect(consumePasskeyChallengeCookie(cookieStore, {
            flow: 'authenticate',
            rpId: 'animecon.team',
            userId: 42,
        })).toBeUndefined();

        cookieStore.set('passkey_challenge', 'not-a-valid-token', {});
        expect(consumePasskeyChallengeCookie(cookieStore, {
            flow: 'authenticate',
            rpId: 'animecon.team',
            userId: 42,
        })).toBeUndefined();
    });
});
