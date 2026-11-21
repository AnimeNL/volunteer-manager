// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify<string, string, number, crypto.ScryptOptions, Buffer>(
    crypto.scrypt as any);

/**
 * Current OWASP-recommended Argon2id parameters (19 MiB memory, 2 passes, 1 lane, 32-byte tag).
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
const kArgon2MemoryKiB = 19_456;
const kArgon2Passes = 2;
const kArgon2Parallelism = 1;
const kArgon2SaltLengthBytes = 16;
const kArgon2TagLengthBytes = 32;

/**
 * Password length bounds enforced on creation and verification to prevent DoS on oversized inputs.
 */
const kMinimumPasswordLength = 8;
const kMaximumPasswordLength = 128;

/**
 * Safety bounds applied when parsing stored Argon2id PHC strings to prevent resource exhaustion or
 * OpenSSL errors if a database credential row is malformed.
 */
const kMaxArgon2MemoryKiB = 262_144;
const kMaxArgon2Passes = 16;
const kMaxArgon2Parallelism = 8;
const kMinArgon2SaltLengthBytes = 8;
const kMinArgon2TagLengthBytes = 4;
const kMaxArgon2TagLengthBytes = 64;

/**
 * Prefix marking legacy v0 (client-SHA256 + static-salted scrypt) hashes that have been wrapped
 * offline with Argon2id + a per-user salt to eliminate cross-account hash correlation at rest.
 */
const kLegacyWrappedPrefix = '$legacy-v0';

/**
 * Patterns matching legacy v0 (64 hex chars) and standard Argon2id PHC strings.
 */
const kLegacyHexHashPattern = /^[0-9a-f]{64}$/;
const kArgon2PhcPattern =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/**
 * Legacy scrypt parameters used before the migration to Argon2id.
 */
const kLegacyScryptN = 2 ** 14;
const kLegacyScryptR = 8;
const kLegacyScryptP = 5;
const kLegacyScryptKeyLength = 32;

/**
 * Result returned by `verifyPassword()`, indicating both whether the password matched and whether
 * the stored credential should be silently upgraded via `hashPassword()`.
 */
interface PasswordVerificationResult {
    valid: boolean;
    needsUpgrade: boolean;
}

/**
 * Encodes raw bytes as unpadded Base64, matching the standard PHC string specification.
 */
function toPhcBase64(bytes: Buffer): string {
    return bytes.toString('base64').replace(/=+$/, '');
}

/**
 * Computes an Argon2id derived key asynchronously on Node's libuv threadpool.
 */
function deriveArgon2id(
    message: string, nonce: Buffer, memory: number, passes: number, parallelism: number,
    tagLength: number): Promise<Buffer>
{
    return new Promise((resolve, reject) => {
        crypto.argon2('argon2id', {
            message,
            nonce,
            memory,
            passes,
            parallelism,
            tagLength,
        }, (error, derivedKey) => {
            error ? reject(error)
                  : resolve(derivedKey);
        });
    });
}

/**
 * Hashes `message` with Argon2id using current parameters and a fresh random salt, returning a
 * self-describing PHC string.
 */
async function hashArgon2id(message: string): Promise<string> {
    const salt = crypto.randomBytes(kArgon2SaltLengthBytes);
    const derived = await deriveArgon2id(
        message, salt, kArgon2MemoryKiB, kArgon2Passes, kArgon2Parallelism, kArgon2TagLengthBytes);

    return `$argon2id$v=19$m=${kArgon2MemoryKiB},t=${kArgon2Passes},p=${kArgon2Parallelism}` +
        `$${toPhcBase64(salt)}$${toPhcBase64(derived)}`;
}

/**
 * Verifies `message` against an Argon2id PHC string using constant-time comparison.
 */
async function verifyArgon2id(message: string, phcHash: string)
    : Promise<{ valid: boolean; currentParams: boolean }>
{
    const match = kArgon2PhcPattern.exec(phcHash);
    if (!match)
        return { valid: false, currentParams: false };

    const memory = Number.parseInt(match[1], 10);
    const passes = Number.parseInt(match[2], 10);
    const parallelism = Number.parseInt(match[3], 10);
    const salt = Buffer.from(match[4], 'base64');
    const expected = Buffer.from(match[5], 'base64');

    if (parallelism <= 0 || parallelism > kMaxArgon2Parallelism ||
        memory < 8 * parallelism || memory > kMaxArgon2MemoryKiB ||
        passes <= 0 || passes > kMaxArgon2Passes ||
        salt.length < kMinArgon2SaltLengthBytes ||
        expected.length < kMinArgon2TagLengthBytes ||
        expected.length > kMaxArgon2TagLengthBytes)
    {
        return { valid: false, currentParams: false };
    }

    const actual = await deriveArgon2id(
        message, salt, memory, passes, parallelism, expected.length);

    const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    const currentParams =
        memory >= kArgon2MemoryKiB &&
        passes >= kArgon2Passes &&
        parallelism >= kArgon2Parallelism &&
        expected.length >= kArgon2TagLengthBytes;

    return { valid, currentParams };
}

/**
 * Computes the legacy v0 hash (`scrypt(sha256(plaintext), APP_PASSWORD_SALT)`) asynchronously.
 */
async function computeLegacyHash(plaintext: string): Promise<string> {
    if (!Object.hasOwn(process.env, 'APP_PASSWORD_SALT') || !process.env.APP_PASSWORD_SALT)
        throw new Error('APP_PASSWORD_SALT must be configured to verify legacy password hashes.');

    const sha256Hex = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
    const derived = await scryptAsync(
        sha256Hex,
        process.env.APP_PASSWORD_SALT,
        kLegacyScryptKeyLength,
        {
            N: kLegacyScryptN,
            r: kLegacyScryptR,
            p: kLegacyScryptP,
            maxmem: Math.max(32 * 1024 * 1024, 256 * kLegacyScryptN * kLegacyScryptR),
        });

    return derived.toString('hex');
}

/**
 * Validates that a newly chosen plaintext password satisfies server-side strength requirements.
 * Returns a human-readable error message on failure, or `undefined` when valid.
 */
export function validatePasswordStrength(plaintext: string): string | undefined {
    if (plaintext.length > kMaximumPasswordLength)
        return `Your password must be at most ${kMaximumPasswordLength} characters long.`;

    if (plaintext.length < kMinimumPasswordLength ||
        !/[a-z]/.test(plaintext) ||
        !/[A-Z]/.test(plaintext) ||
        !/[0-9]/.test(plaintext))
    {
        return 'Your password must be at least 8 characters long, contain at least one number, ' +
            'one lowercase character and one uppercase character.';
    }

    return undefined;
}

/**
 * Hashes a plaintext password using Argon2id with a unique per-password random salt.
 */
export async function hashPassword(plaintext: string): Promise<string> {
    if (!plaintext.length || plaintext.length > kMaximumPasswordLength) {
        throw new Error(
            `Password length must be between 1 and ${kMaximumPasswordLength} characters.`);
    }

    return hashArgon2id(plaintext);
}

/**
 * Verifies a plaintext password against any supported stored hash format (current Argon2id PHC,
 * offline-wrapped `$legacy-v0$argon2id$...`, or raw 64-hex legacy scrypt). When `needsUpgrade` is
 * true, callers should silently re-hash `plaintext` with `hashPassword()` and persist it.
 */
export async function verifyPassword(
    plaintext: string, storedHash: string): Promise<PasswordVerificationResult>
{
    if (!plaintext.length || plaintext.length > kMaximumPasswordLength)
        return { valid: false, needsUpgrade: false };

    if (storedHash.startsWith('$argon2id$')) {
        const { valid, currentParams } = await verifyArgon2id(plaintext, storedHash);
        return { valid, needsUpgrade: valid && !currentParams };
    }

    if (storedHash.startsWith(`${kLegacyWrappedPrefix}$argon2id$`)) {
        const legacyHex = await computeLegacyHash(plaintext);
        const innerPhc = storedHash.slice(kLegacyWrappedPrefix.length);
        const { valid } = await verifyArgon2id(legacyHex, innerPhc);
        return { valid, needsUpgrade: valid };
    }

    if (kLegacyHexHashPattern.test(storedHash)) {
        const legacyHex = await computeLegacyHash(plaintext);
        const valid = crypto.timingSafeEqual(
            Buffer.from(legacyHex, 'hex'),
            Buffer.from(storedHash, 'hex'));

        return { valid, needsUpgrade: valid };
    }

    return { valid: false, needsUpgrade: false };
}

/**
 * Wraps a raw legacy v0 64-hex password hash with Argon2id and a unique random salt so dormant
 * accounts gain per-user salting at rest before they ever sign in again.
 */
export async function wrapLegacyPasswordHash(legacyHexHash: string): Promise<string> {
    if (!kLegacyHexHashPattern.test(legacyHexHash))
        throw new Error('Only 64-character hex legacy hashes can be wrapped.');

    return `${kLegacyWrappedPrefix}${await hashArgon2id(legacyHexHash)}`;
}
