// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { checkRateLimit, clearRateLimits, normalizeClientIp, resetRateLimit } from './RateLimit';

describe('RateLimit', () => {
    beforeEach(() => clearRateLimits());
    afterEach(() => vi.useRealTimers());

    it('allows requests up to the limit and rejects excess attempts in the window', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

        const policy = { limit: 3, windowSeconds: 60 };

        expect(checkRateLimit('signIn', 'Alice@Example.com', policy)).toEqual({ allowed: true });
        vi.advanceTimersByTime(10_000);
        expect(checkRateLimit('signIn', 'alice@example.com', policy)).toEqual({ allowed: true });
        vi.advanceTimersByTime(10_000);
        expect(checkRateLimit('signIn', 'alice@example.com', policy)).toEqual({ allowed: true });

        // 4th attempt within the 60s window is rejected; oldest attempt expires in 40s:
        const blocked = checkRateLimit('signIn', 'alice@example.com', policy);
        expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 40 });

        // Different keys and buckets remain unaffected:
        expect(checkRateLimit('signIn', 'bob@example.com', policy)).toEqual({ allowed: true });
        expect(checkRateLimit('reset', 'alice@example.com', policy)).toEqual({ allowed: true });

        // Once the oldest attempt falls outside the window, a new attempt succeeds:
        vi.advanceTimersByTime(40_000);
        expect(checkRateLimit('signIn', 'alice@example.com', policy)).toEqual({ allowed: true });
    });

    it('clears tracked attempts when resetRateLimit is called', () => {
        const policy = { limit: 1, windowSeconds: 60 };

        expect(checkRateLimit('signIn', 'user@example.com', policy).allowed).toBeTruthy();
        expect(checkRateLimit('signIn', 'user@example.com', policy).allowed).toBeFalsy();

        resetRateLimit('signIn', 'USER@example.com');
        expect(checkRateLimit('signIn', 'user@example.com', policy).allowed).toBeTruthy();
    });

    it('normalizes X-Forwarded-For headers cleanly', () => {
        expect(normalizeClientIp(undefined)).toBe('unknown');
        expect(normalizeClientIp('')).toBe('unknown');
        expect(normalizeClientIp('203.0.113.5')).toBe('203.0.113.5');
        expect(normalizeClientIp(' 203.0.113.5 , 10.0.0.1 ')).toBe('203.0.113.5');
        expect(normalizeClientIp('a'.repeat(100))).toHaveLength(64);
    });
});
