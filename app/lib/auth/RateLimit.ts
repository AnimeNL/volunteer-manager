// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

declare namespace globalThis {
    let animeConRateLimitStorage: Map<string, number[]> | undefined;
}

/**
 * Maximum number of distinct bucket+key entries retained in memory to prevent unbounded growth.
 */
const kMaximumTrackedKeys = 10_000;

/**
 * Sliding-window rate limit configuration.
 */
export interface RateLimitPolicy {
    /**
     * Maximum number of requests allowed within `windowSeconds`.
     */
    limit: number;

    /**
     * Length of the sliding window, in seconds.
     */
    windowSeconds: number;
}

/**
 * Result of evaluating a rate limit check.
 */
export interface RateLimitResult {
    /**
     * Whether the request is permitted to proceed.
     */
    allowed: boolean;

    /**
     * When `allowed` is false, the number of seconds until a slot becomes available again.
     */
    retryAfterSeconds?: number;
}

/**
 * Predefined rate limit policies for authentication flows. Per-IP limits are sized to accommodate
 * multiple volunteers sharing convention Wi-Fi NAT while blocking automated abuse.
 */
export const kAuthRateLimits = {
    confirmIdentityByIp: { limit: 30, windowSeconds: 15 * 60 },
    passwordResetByAccount: { limit: 5, windowSeconds: 60 * 60 },
    passwordResetByIp: { limit: 15, windowSeconds: 60 * 60 },
    registerByIp: { limit: 10, windowSeconds: 60 * 60 },
    signInByAccount: { limit: 10, windowSeconds: 15 * 60 },
    signInByIp: { limit: 30, windowSeconds: 15 * 60 },
} satisfies Record<string, RateLimitPolicy>;

/**
 * Returns the shared in-process rate limit store.
 */
function getStorage(): Map<string, number[]> {
    globalThis.animeConRateLimitStorage ??= new Map();
    return globalThis.animeConRateLimitStorage;
}

/**
 * Builds the composite map key for a bucket and identifier.
 */
function toCompositeKey(bucket: string, key: string): string {
    return `${bucket}:${key.trim().toLowerCase()}`;
}

/**
 * Extracts a normalized client IP address from an `X-Forwarded-For` header value.
 */
export function normalizeClientIp(forwardedFor?: string): string {
    const first = forwardedFor?.split(',')[0]?.trim();
    return first ? first.slice(0, 64) : 'unknown';
}

/**
 * Evaluates and records a sliding-window rate limit attempt for `bucket` + `key`.
 */
export function checkRateLimit(
    bucket: string, key: string, policy: RateLimitPolicy): RateLimitResult
{
    const storage = getStorage();
    const compositeKey = toCompositeKey(bucket, key);
    const now = Date.now();
    const windowMs = policy.windowSeconds * 1000;
    const cutoff = now - windowMs;

    const existing = storage.get(compositeKey);
    const active = existing ? existing.filter(timestamp => timestamp > cutoff) : [];

    if (active.length >= policy.limit) {
        storage.delete(compositeKey);
        storage.set(compositeKey, active);

        const retryAfterSeconds = Math.max(1, Math.ceil((active[0] + windowMs - now) / 1000));
        return { allowed: false, retryAfterSeconds };
    }

    active.push(now);
    storage.delete(compositeKey);
    storage.set(compositeKey, active);

    while (storage.size > kMaximumTrackedKeys) {
        const oldestKey = storage.keys().next().value;
        if (oldestKey === undefined)
            break;

        storage.delete(oldestKey);
    }

    return { allowed: true };
}

/**
 * Clears recorded attempts for a single `bucket` + `key` (e.g. after a successful sign-in).
 */
export function resetRateLimit(bucket: string, key: string): void {
    getStorage().delete(toCompositeKey(bucket, key));
}

/**
 * Clears all tracked rate limit state. Intended for use in unit tests.
 */
export function clearRateLimits(): void {
    getStorage().clear();
}
