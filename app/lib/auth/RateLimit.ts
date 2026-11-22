// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import net from 'node:net';

import { RecordErrorLog, kLogSeverity } from '@lib/ErrorLog';

declare namespace globalThis {
    let animeConRateLimitStorage: Map<RateLimitBucket, Map<string, RateLimitEntry>> | undefined;
}

/**
 * Maximum number of distinct keys retained per bucket to prevent unbounded memory growth while
 * isolating buckets from cross-bucket eviction.
 */
const kMaximumTrackedKeysPerBucket = 5_000;

/**
 * Tracked sliding-window state for a single key within a bucket.
 */
interface RateLimitEntry {
    timestamps: number[];
    logged: boolean;
}

/**
 * Distinct rate limit buckets for authentication flows.
 */
type RateLimitBucket =
    'avatar-upload-user' |
    'confirm-identity-ip' |
    'password-change-user' |
    'password-reset-account' |
    'password-reset-ip' |
    'register-ip' |
    'signin-account' |
    'signin-ip';

/**
 * Sliding-window rate limit configuration.
 */
interface RateLimitPolicy {
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
interface RateLimitResult {
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
    avatarUploadByUser: { limit: 20, windowSeconds: 60 * 60 },
    confirmIdentityByIp: { limit: 30, windowSeconds: 15 * 60 },
    passwordChangeByUser: { limit: 10, windowSeconds: 15 * 60 },
    passwordResetByAccount: { limit: 5, windowSeconds: 60 * 60 },
    passwordResetByIp: { limit: 15, windowSeconds: 60 * 60 },
    registerByIp: { limit: 10, windowSeconds: 60 * 60 },
    signInByAccount: { limit: 10, windowSeconds: 15 * 60 },
    signInByIp: { limit: 30, windowSeconds: 15 * 60 },
} satisfies Record<string, RateLimitPolicy>;

/**
 * Returns the shared in-process rate limit store.
 */
function getStorage(): Map<RateLimitBucket, Map<string, RateLimitEntry>> {
    globalThis.animeConRateLimitStorage ??= new Map();
    return globalThis.animeConRateLimitStorage;
}

/**
 * Returns the isolated map for a single rate limit `bucket`.
 */
function getBucketStorage(bucket: RateLimitBucket): Map<string, RateLimitEntry> {
    const storage = getStorage();
    let bucketMap = storage.get(bucket);
    if (!bucketMap) {
        bucketMap = new Map();
        storage.set(bucket, bucketMap);
    }

    return bucketMap;
}

/**
 * Parses one side of a `::`-split IPv6 address (with optional trailing dotted-quad IPv4) into
 * 16-bit integer groups.
 */
function parseIpv6Side(part: string): number[] | undefined {
    if (!part)
        return [];

    const segments = part.split(':');
    const groups: number[] = [];

    for (let index = 0; index < segments.length; ++index) {
        const segment = segments[index];
        if (segment.includes('.') && index === segments.length - 1) {
            if (!net.isIPv4(segment))
                return undefined;

            const octets = segment.split('.').map(octet => Number.parseInt(octet, 10));
            groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
        } else {
            if (!/^[0-9a-f]{1,4}$/.test(segment))
                return undefined;

            groups.push(Number.parseInt(segment, 16));
        }
    }

    return groups;
}

/**
 * Parses a valid IPv6 address into 8 16-bit integer groups.
 */
function parseIpv6Groups(address: string): number[] | undefined {
    const halves = address.split('::');
    if (halves.length > 2)
        return undefined;

    const left = parseIpv6Side(halves[0]);
    if (!left)
        return undefined;

    if (halves.length === 1)
        return left.length === 8 ? left : undefined;

    const right = parseIpv6Side(halves[1]);
    if (!right)
        return undefined;

    const missing = 8 - left.length - right.length;
    if (missing < 1)
        return undefined;

    return [ ...left, ...Array<number>(missing).fill(0), ...right ];
}

/**
 * Normalizes a rate limit key. IPv4-mapped IPv6 addresses are unwrapped to IPv4, and IPv6
 * addresses are bucketed by their `/64` network prefix so rotating interface identifiers within a
 * residential or mobile allocation cannot bypass per-IP limits.
 */
function normalizeRateLimitKey(key: string): string {
    const normalized = key.trim().toLowerCase();
    if (!net.isIPv6(normalized))
        return normalized;

    const groups = parseIpv6Groups(normalized);
    if (!groups)
        return normalized;

    const isIpv4Mapped =
        groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
        groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff;

    if (isIpv4Mapped) {
        return `${groups[6] >> 8}.${groups[6] & 0xff}.` +
            `${groups[7] >> 8}.${groups[7] & 0xff}`;
    }

    return `${groups.slice(0, 4).map(group => group.toString(16)).join(':')}::/64`;
}

/**
 * Extracts a normalized client IP address from an `X-Forwarded-For` header value.
 */
export function normalizeClientIp(forwardedFor?: string): string {
    const first = forwardedFor?.split(',')[0]?.trim();
    return first ? first.slice(0, 64) : 'unknown';
}

/**
 * Evicts the least-recently-updated entries when `bucketStorage` exceeds its capacity cap.
 */
function evictOverflowEntries(bucketStorage: Map<string, RateLimitEntry>): void {
    while (bucketStorage.size > kMaximumTrackedKeysPerBucket) {
        const oldestKey = bucketStorage.keys().next().value;
        if (oldestKey === undefined)
            break;

        bucketStorage.delete(oldestKey);
    }
}

/**
 * Evaluates and records a sliding-window rate limit attempt for `bucket` + `key`.
 */
export function checkRateLimit(
    bucket: RateLimitBucket, key: string, policy: RateLimitPolicy): RateLimitResult
{
    const bucketStorage = getBucketStorage(bucket);
    const normalizedKey = normalizeRateLimitKey(key);
    const now = Date.now();
    const windowMs = policy.windowSeconds * 1000;
    const cutoff = now - windowMs;

    const existing = bucketStorage.get(normalizedKey);
    const active = existing ? existing.timestamps.filter(timestamp => timestamp > cutoff) : [];

    if (active.length >= policy.limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((active[0] + windowMs - now) / 1000));

        bucketStorage.delete(normalizedKey);
        bucketStorage.set(normalizedKey, { timestamps: active, logged: true });

        if (!existing?.logged) {
            RecordErrorLog({
                error: {
                    name: 'RateLimitExceeded',
                    message: `Rate limit reached for "${bucket}" (${policy.limit} requests ` +
                        `per ${policy.windowSeconds}s; retry after ${retryAfterSeconds}s)`,
                },
                severity: kLogSeverity.Info,
            });
        }

        return { allowed: false, retryAfterSeconds };
    }

    active.push(now);
    bucketStorage.delete(normalizedKey);
    bucketStorage.set(normalizedKey, { timestamps: active, logged: false });
    evictOverflowEntries(bucketStorage);

    return { allowed: true };
}

/**
 * Clears recorded attempts for a single `bucket` + `key` (e.g. after a successful sign-in).
 */
export function resetRateLimit(bucket: RateLimitBucket, key: string): void {
    getBucketStorage(bucket).delete(normalizeRateLimitKey(key));
}

/**
 * Clears all tracked rate limit state. Intended for use in unit tests.
 */
export function clearRateLimits(): void {
    getStorage().clear();
}
