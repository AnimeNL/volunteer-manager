// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import crypto from 'node:crypto';

/**
 * Current wire format version for sealed tokens.
 */
const kTokenVersion = 'v1';

/**
 * Minimum length required for any sealing secret, in characters.
 */
const kMinimumSecretLength = 32;

/**
 * Reads a sealing secret from `process.env[envName]` at module startup, throwing immediately when
 * missing or shorter than `kMinimumSecretLength` characters.
 */
export function requireSealingSecret(envName: string): string {
    const secret = process.env[envName];
    if (!secret || secret.length < kMinimumSecretLength) {
        throw new Error(
            `Unable to start the Volunteer Manager: ${envName} must be at least ` +
            `${kMinimumSecretLength} characters long.`);
    }

    return secret;
}

/**
 * Cryptographic parameter sizes for AES-256-GCM.
 */
const kKeyLengthBytes = 32;
const kIvLengthBytes = 12;
const kAuthTagLengthBytes = 16;
const kKeyIdLengthBytes = 6;

/**
 * Fixed domain-separation salts used for HKDF key derivation and key identifiers.
 */
const kHkdfSalt = Buffer.from('animecon-sealed-token-v1', 'utf8');
const kKeyIdContext = 'animecon-sealed-token-kid-v1';

/**
 * Distinct purposes for which tokens may be sealed. Keys and authenticated data are
 * cryptographically separated per purpose so a token issued for one purpose can never be unsealed
 * for another.
 */
type SealedTokenPurpose =
    'display' |
    'passkey-challenge' |
    'password-reset' |
    'registration' |
    'session';

/**
 * Secret material accepted by `sealToken` and `unsealToken`. Pass a single secret string, or an
 * ordered list of secrets (primary first, previous keys following) to support zero-downtime key
 * rotation.
 */
type SealingSecret = string | readonly string[];

/**
 * Internal envelope serialized inside the encrypted payload.
 */
interface TokenEnvelope {
    data: unknown;
    exp: number;
}

/**
 * Normalizes and validates the provided `secrets`, computing a stable URL-safe key identifier for
 * each entry.
 */
function resolveKeys(secrets: SealingSecret): { id: string; secret: string }[] {
    const rawSecrets = typeof secrets === 'string' ? [ secrets ] : secrets;
    if (!rawSecrets.length)
        throw new Error('At least one sealing secret must be provided.');

    return rawSecrets.map(secret => {
        if (secret.length < kMinimumSecretLength) {
            throw new Error(
                `Sealing secrets must be at least ${kMinimumSecretLength} characters long.`);
        }

        const id = crypto.createHmac('sha256', secret)
            .update(kKeyIdContext)
            .digest()
            .subarray(0, kKeyIdLengthBytes)
            .toString('base64url');

        return { id, secret };
    });
}

/**
 * Derives a 256-bit AES key scoped to the given `purpose` using HKDF-SHA256.
 */
function deriveEncryptionKey(secret: string, purpose: SealedTokenPurpose): Buffer {
    return Buffer.from(crypto.hkdfSync(
        'sha256',
        Buffer.from(secret, 'utf8'),
        kHkdfSalt,
        Buffer.from(`animecon:${purpose}:${kTokenVersion}`, 'utf8'),
        kKeyLengthBytes));
}

/**
 * Builds the Additional Authenticated Data (AAD) binding version, purpose, and key ID.
 */
function buildAad(purpose: SealedTokenPurpose, keyId: string): Buffer {
    return Buffer.from(`${kTokenVersion}|${purpose}|${keyId}`, 'utf8');
}

/**
 * Encrypts and authenticates `data` for the given `purpose` using AES-256-GCM with an HKDF-derived
 * key. The returned token is URL-safe (`v1.<kid>.<payload>`) and valid for `ttlSeconds`.
 */
export function sealToken(
    data: unknown,
    purpose: SealedTokenPurpose,
    secrets: SealingSecret,
    ttlSeconds: number): string
{
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0)
        throw new Error('The token TTL must be a positive number of seconds.');

    const [ primaryKey ] = resolveKeys(secrets);

    const encryptionKey = deriveEncryptionKey(primaryKey.secret, purpose);
    const iv = crypto.randomBytes(kIvLengthBytes);

    const envelope: TokenEnvelope = {
        data,
        exp: Date.now() + ttlSeconds * 1000,
    };

    const cipher = crypto.createCipheriv(
        'aes-256-gcm', encryptionKey, iv, { authTagLength: kAuthTagLengthBytes });
    cipher.setAAD(buildAad(purpose, primaryKey.id));

    const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(envelope), 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([ iv, authTag, ciphertext ]).toString('base64url');

    return `${kTokenVersion}.${primaryKey.id}.${payload}`;
}

/**
 * Decrypts, authenticates, and validates expiration of a sealed `token` for the given `purpose`.
 * Throws an error if the token is malformed, uses an unknown key, fails authentication, was issued
 * for a different purpose, or has expired.
 */
export function unsealToken<T = unknown>(
    token: string,
    purpose: SealedTokenPurpose,
    secrets: SealingSecret): T
{
    const keys = resolveKeys(secrets);

    const parts = token.split('.');
    if (parts.length !== 3)
        throw new Error('Invalid sealed token format.');

    const [ version, keyId, encodedPayload ] = parts;
    if (version !== kTokenVersion)
        throw new Error(`Unsupported sealed token version: "${version}".`);

    const matchingKey = keys.find(key => key.id === keyId);
    if (!matchingKey)
        throw new Error('Sealed token was signed with an unknown key.');

    const rawPayload = Buffer.from(encodedPayload, 'base64url');
    if (rawPayload.length < kIvLengthBytes + kAuthTagLengthBytes)
        throw new Error('Sealed token payload is truncated.');

    const iv = rawPayload.subarray(0, kIvLengthBytes);
    const authTag = rawPayload.subarray(kIvLengthBytes, kIvLengthBytes + kAuthTagLengthBytes);
    const ciphertext = rawPayload.subarray(kIvLengthBytes + kAuthTagLengthBytes);

    const encryptionKey = deriveEncryptionKey(matchingKey.secret, purpose);

    const decipher = crypto.createDecipheriv(
        'aes-256-gcm', encryptionKey, iv, { authTagLength: kAuthTagLengthBytes });
    decipher.setAAD(buildAad(purpose, keyId));
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]).toString('utf8');

    const envelope = JSON.parse(plaintext) as TokenEnvelope;
    if (typeof envelope?.exp !== 'number' || envelope.exp <= Date.now())
        throw new Error('Sealed token has expired.');

    return envelope.data as T;
}
