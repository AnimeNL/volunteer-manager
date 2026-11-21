// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import * as Log from '@lib/Log';
import { checkRateLimit, clearRateLimits, normalizeClientIp, resetRateLimit } from './RateLimit';

describe('RateLimit', () => {
    let errorLogDelegateInvocations = 0;

    beforeEach(() => {
        clearRateLimits();
        errorLogDelegateInvocations = 0;
        Log.SetRecordErrorLogDeferDelegate(() => {
            errorLogDelegateInvocations++;
        });
    });

    afterEach(() => {
        Log.SetRecordErrorLogDeferDelegate(/* delegate= */ undefined);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('allows requests up to the limit and rejects excess attempts in the window', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

        const recordErrorLogSpy = vi.spyOn(Log, 'RecordErrorLog');
        const policy = { limit: 3, windowSeconds: 60 };

        expect(checkRateLimit('signin-account', 'Alice@Example.com', policy)).toEqual({
            allowed: true,
        });
        vi.advanceTimersByTime(10_000);
        expect(checkRateLimit('signin-account', 'alice@example.com', policy)).toEqual({
            allowed: true,
        });
        vi.advanceTimersByTime(10_000);
        expect(checkRateLimit('signin-account', 'alice@example.com', policy)).toEqual({
            allowed: true,
        });
        expect(recordErrorLogSpy).not.toHaveBeenCalled();
        expect(errorLogDelegateInvocations).toBe(0);

        // 4th attempt within the 60s window is rejected; oldest attempt expires in 40s:
        const blocked = checkRateLimit('signin-account', 'alice@example.com', policy);
        expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 40 });
        expect(recordErrorLogSpy).toHaveBeenCalledTimes(1);
        expect(recordErrorLogSpy).toHaveBeenCalledWith({
            error: {
                name: 'RateLimitExceeded',
                message: 'Rate limit reached for "signin-account" (3 requests per 60s; ' +
                    'retry after 40s)',
            },
            severity: Log.kLogSeverity.Info,
        });
        expect(errorLogDelegateInvocations).toBe(1);

        // Subsequent blocked attempts in the same breach do not re-emit error logs:
        expect(checkRateLimit('signin-account', 'alice@example.com', policy).allowed).toBe(false);
        expect(recordErrorLogSpy).toHaveBeenCalledTimes(1);

        // Different keys and buckets remain unaffected:
        expect(checkRateLimit('signin-account', 'bob@example.com', policy)).toEqual({
            allowed: true,
        });
        expect(checkRateLimit('password-reset-account', 'alice@example.com', policy)).toEqual({
            allowed: true,
        });
        expect(errorLogDelegateInvocations).toBe(1);

        // Once the oldest attempt falls outside the window, a new attempt succeeds, and a fresh
        // breach logs once again:
        vi.advanceTimersByTime(40_000);
        expect(checkRateLimit('signin-account', 'alice@example.com', policy)).toEqual({
            allowed: true,
        });
        expect(checkRateLimit('signin-account', 'alice@example.com', policy).allowed).toBe(false);
        expect(errorLogDelegateInvocations).toBe(2);
    });

    it('clears tracked attempts when resetRateLimit is called', () => {
        const policy = { limit: 1, windowSeconds: 60 };

        expect(checkRateLimit('signin-account', 'user@example.com', policy).allowed).toBeTruthy();
        expect(checkRateLimit('signin-account', 'user@example.com', policy).allowed).toBeFalsy();

        resetRateLimit('signin-account', 'USER@example.com');
        expect(checkRateLimit('signin-account', 'user@example.com', policy).allowed).toBeTruthy();
    });

    it('buckets IPv6 addresses by /64 prefix and unwraps IPv4-mapped IPv6 addresses', () => {
        const policy = { limit: 2, windowSeconds: 60 };

        // Two distinct addresses in the same /64 (with different formatting) share a bucket:
        expect(checkRateLimit('signin-ip', '2001:0db8:0001:0002::1', policy).allowed).toBeTruthy();
        expect(checkRateLimit(
            'signin-ip', '2001:db8:1:2:abcd:1234:5678:9abc', policy).allowed).toBeTruthy();
        expect(checkRateLimit('signin-ip', '2001:db8:1:2::ffff', policy).allowed).toBeFalsy();

        // A different /64 subnet is unaffected:
        expect(checkRateLimit('signin-ip', '2001:db8:1:3::1', policy).allowed).toBeTruthy();

        // IPv4-mapped IPv6 shares the same bucket as the underlying IPv4 address:
        expect(checkRateLimit('signin-ip', '203.0.113.5', policy).allowed).toBeTruthy();
        expect(checkRateLimit('signin-ip', '::ffff:203.0.113.5', policy).allowed).toBeTruthy();
        expect(checkRateLimit('signin-ip', '::FFFF:203.0.113.5', policy).allowed).toBeFalsy();
    });

    it('normalizes X-Forwarded-For headers cleanly', () => {
        expect(normalizeClientIp(undefined)).toBe('unknown');
        expect(normalizeClientIp('')).toBe('unknown');
        expect(normalizeClientIp('203.0.113.5')).toBe('203.0.113.5');
        expect(normalizeClientIp(' 203.0.113.5 , 10.0.0.1 ')).toBe('203.0.113.5');
        expect(normalizeClientIp('a'.repeat(100))).toHaveLength(64);
    });

    it('isolates per-bucket maps so IP churn cannot evict account rate limits', () => {
        const policy = { limit: 1, windowSeconds: 60 };
        expect(checkRateLimit('signin-account', 'victim@example.com', policy).allowed).toBe(true);
        expect(checkRateLimit('signin-account', 'victim@example.com', policy).allowed).toBe(false);

        for (let i = 0; i < 5_100; ++i)
            checkRateLimit('signin-ip', `198.51.${Math.floor(i / 256)}.${i % 256}`, policy);

        expect(checkRateLimit('signin-account', 'victim@example.com', policy).allowed).toBe(false);
    });
});
