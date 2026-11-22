// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { requireSealingSecret, sealToken, unsealToken } from './SealedToken';

describe('SealedToken', () => {
    const kPrimarySecret = 'F4y%8wsHR(,fRML4Dg;ilT4{H2J5sSf<';
    const kSecondarySecret = '0ySycf@=slZNkn.R9zX.n+OL2+H<=YQW';

    afterEach(() => {
        delete process.env.TEST_SEALING_SECRET;
        vi.useRealTimers();
    });

    it('enforces secret length and positive TTL validation', () => {
        expect(() => requireSealingSecret('TEST_SEALING_SECRET')).toThrow(/at least 32/);
        process.env.TEST_SEALING_SECRET = 'too-short';
        expect(() => requireSealingSecret('TEST_SEALING_SECRET')).toThrow(/at least 32/);
        process.env.TEST_SEALING_SECRET = kPrimarySecret;
        expect(requireSealingSecret('TEST_SEALING_SECRET')).toBe(kPrimarySecret);

        expect(() => sealToken({}, 'session', 'too-short', 60)).toThrow(/at least 32/);
        expect(() => sealToken({}, 'session', [], 60)).toThrow(/At least one/);
        expect(() => sealToken({}, 'session', kPrimarySecret, 0)).toThrow(/positive/);
        expect(() => sealToken({}, 'session', kPrimarySecret, -5)).toThrow(/positive/);
        expect(() => sealToken({}, 'session', kPrimarySecret, Number.NaN)).toThrow(/positive/);
        expect(() => unsealToken('v1.abc.def', 'session', 'too-short')).toThrow(/at least 32/);
    });

    it('roundtrips various JSON-serializable payloads with a URL-safe wire format', () => {
        const samples = [ null, true, false, 1.2345, 'hello, world', { id: 42, token: 9001 } ];

        for (const sample of samples) {
            const sealed = sealToken(sample, 'session', kPrimarySecret, 60);
            expect(sealed).toMatch(/^v1\.[A-Za-z0-9_-]{8}\.[A-Za-z0-9_-]+$/);
            expect(unsealToken(sealed, 'session', kPrimarySecret)).toEqual(sample);
        }
    });

    it('produces distinct ciphertexts for identical payloads', () => {
        const first = sealToken({ id: 1 }, 'session', kPrimarySecret, 60);
        const second = sealToken({ id: 1 }, 'session', kPrimarySecret, 60);

        expect(first).not.toEqual(second);
    });

    it('enforces strict cryptographic separation between token purposes', () => {
        const sessionToken = sealToken({ id: 5, token: 123 }, 'session', kPrimarySecret, 60);

        expect(unsealToken(sessionToken, 'session', kPrimarySecret)).toEqual({ id: 5, token: 123 });
        expect(() => unsealToken(sessionToken, 'display', kPrimarySecret)).toThrow();
        expect(() => unsealToken(sessionToken, 'password-reset', kPrimarySecret)).toThrow();
        expect(() => unsealToken(sessionToken, 'registration', kPrimarySecret)).toThrow();
        expect(() => unsealToken(sessionToken, 'passkey-challenge', kPrimarySecret)).toThrow();
    });

    it('supports zero-downtime key rotation via ordered secret lists', () => {
        const oldToken = sealToken({ id: 42 }, 'session', kSecondarySecret, 60);
        const newToken = sealToken(
            { id: 99 }, 'session', [ kPrimarySecret, kSecondarySecret ], 60);

        // Both old and new tokens unseal while both secrets are configured:
        expect(unsealToken(oldToken, 'session', [ kPrimarySecret, kSecondarySecret ]))
            .toEqual({ id: 42 });
        expect(unsealToken(newToken, 'session', [ kPrimarySecret, kSecondarySecret ]))
            .toEqual({ id: 99 });

        // New tokens are sealed with the primary key, not the secondary key:
        expect(unsealToken(newToken, 'session', kPrimarySecret)).toEqual({ id: 99 });
        expect(() => unsealToken(newToken, 'session', kSecondarySecret)).toThrow(/unknown key/);

        // Removing the old key immediately invalidates tokens sealed with it:
        expect(() => unsealToken(oldToken, 'session', kPrimarySecret)).toThrow(/unknown key/);
    });

    it('rejects tampered payloads, key identifiers, versions, and truncated tokens', () => {
        const sealed = sealToken({ id: 42 }, 'session', kPrimarySecret, 60);
        const [ version, keyId, payload ] = sealed.split('.');

        // Flip a byte in the encoded ciphertext/tag payload:
        const payloadBytes = Buffer.from(payload, 'base64url');
        payloadBytes[payloadBytes.length - 1] ^= 0xff;
        const tamperedPayload = `${version}.${keyId}.${payloadBytes.toString('base64url')}`;
        expect(() => unsealToken(tamperedPayload, 'session', kPrimarySecret)).toThrow();

        // Flip a byte in the auth tag:
        const tagBytes = Buffer.from(payload, 'base64url');
        tagBytes[14] ^= 0x01;
        const tamperedTag = `${version}.${keyId}.${tagBytes.toString('base64url')}`;
        expect(() => unsealToken(tamperedTag, 'session', kPrimarySecret)).toThrow();

        // Malformed structures:
        expect(() => unsealToken(`v2.${keyId}.${payload}`, 'session', kPrimarySecret))
            .toThrow(/Unsupported sealed token version/);
        expect(() => unsealToken('only-one-part', 'session', kPrimarySecret))
            .toThrow(/Invalid sealed token format/);
        expect(() => unsealToken(`${version}.${keyId}.shor`, 'session', kPrimarySecret))
            .toThrow(/truncated/);
        expect(() => unsealToken(`${version}.${keyId}.short`, 'session', kPrimarySecret))
            .toThrow(/Invalid sealed token format/);
        expect(() => unsealToken(`${sealed}!`, 'session', kPrimarySecret))
            .toThrow(/Invalid sealed token format/);
        expect(() => unsealToken(`${sealed}=`, 'session', kPrimarySecret))
            .toThrow(/Invalid sealed token format/);
        expect(() => unsealToken(`${version}.${keyId}!$.${payload}`, 'session', kPrimarySecret))
            .toThrow(/Invalid sealed token format/);

        // Reject non-canonical base64url payload (mutated unused trailing bits):
        const nonCanonicalPayload = (() => {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
            const rem = payload.length % 4;
            if (rem === 0)
                return `${payload}A`;

            const lastIdx = alphabet.indexOf(payload[payload.length - 1]);
            const mutated = alphabet[lastIdx ^ 1];
            return `${payload.slice(0, -1)}${mutated}`;
        })();
        expect(() => unsealToken(
            `${version}.${keyId}.${nonCanonicalPayload}`, 'session', kPrimarySecret))
            .toThrow(/Invalid sealed token format/);
    });

    it('rejects expired tokens only after authentication succeeds', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

        const sealed = sealToken({ id: 42 }, 'password-reset', kPrimarySecret, 60);
        expect(unsealToken(sealed, 'password-reset', kPrimarySecret)).toEqual({ id: 42 });

        vi.advanceTimersByTime(60_000);
        expect(() => unsealToken(sealed, 'password-reset', kPrimarySecret)).toThrow(/expired/);
    });
});
