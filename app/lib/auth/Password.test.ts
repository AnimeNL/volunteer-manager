// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import crypto from 'node:crypto';

import { hashPassword, validatePasswordStrength, verifyPassword, wrapLegacyPasswordHash }
    from './Password';

describe('Password', () => {
    afterEach(() => {
        delete process.env.APP_PASSWORD_SALT;
    });

    it('hashes and verifies passwords with Argon2id and unique per-password salts', async () => {
        const firstHash = await hashPassword('CorrectHorse1');
        const secondHash = await hashPassword('CorrectHorse1');

        expect(firstHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
        expect(firstHash).not.toEqual(secondHash);

        await expect(verifyPassword('CorrectHorse1', firstHash))
            .resolves.toEqual({ valid: true, needsUpgrade: false });
        await expect(verifyPassword('CorrectHorse1', secondHash))
            .resolves.toEqual({ valid: true, needsUpgrade: false });
        await expect(verifyPassword('WrongPassword1', firstHash))
            .resolves.toEqual({ valid: false, needsUpgrade: false });
    });

    it('flags Argon2id hashes with weaker parameters for silent upgrade', async () => {
        const salt = crypto.randomBytes(16);
        const derived = crypto.argon2Sync('argon2id', {
            message: 'CorrectHorse1',
            nonce: salt,
            memory: 4096,
            passes: 1,
            parallelism: 1,
            tagLength: 32,
        });

        const weakPhc = `$argon2id$v=19$m=4096,t=1,p=1$` +
            `${salt.toString('base64').replace(/=+$/, '')}$` +
            `${derived.toString('base64').replace(/=+$/, '')}`;

        await expect(verifyPassword('CorrectHorse1', weakPhc))
            .resolves.toEqual({ valid: true, needsUpgrade: true });
        await expect(verifyPassword('WrongPassword1', weakPhc))
            .resolves.toEqual({ valid: false, needsUpgrade: false });
    });

    it('verifies raw legacy v0 hashes and marks them for silent upgrade', async () => {
        process.env.APP_PASSWORD_SALT = 'FirstSalt';

        // Known reference vector from the legacy scrypt(sha256(pw), 'FirstSalt') implementation:
        const legacyHash = 'ca21cf41529f899ba3e54d17691608525e28b78e1083b017764060d51532e30d';

        await expect(verifyPassword('changeme1234', legacyHash))
            .resolves.toEqual({ valid: true, needsUpgrade: true });
        await expect(verifyPassword('wrongpass123', legacyHash))
            .resolves.toEqual({ valid: false, needsUpgrade: false });
    });

    it('wraps dormant legacy v0 hashes with per-user Argon2id salts', async () => {
        process.env.APP_PASSWORD_SALT = 'FirstSalt';
        const legacyHash = 'ca21cf41529f899ba3e54d17691608525e28b78e1083b017764060d51532e30d';

        const wrappedFirst = await wrapLegacyPasswordHash(legacyHash);
        const wrappedSecond = await wrapLegacyPasswordHash(legacyHash);

        expect(wrappedFirst).toMatch(/^\$legacy-v0\$argon2id\$v=19\$/);
        expect(wrappedFirst).not.toEqual(wrappedSecond);

        await expect(verifyPassword('changeme1234', wrappedFirst))
            .resolves.toEqual({ valid: true, needsUpgrade: true });
        await expect(verifyPassword('wrongpass123', wrappedFirst))
            .resolves.toEqual({ valid: false, needsUpgrade: false });

        await expect(wrapLegacyPasswordHash('not-a-hex-hash')).rejects.toThrow();
    });

    it('rejects empty, oversized, and malformed inputs cleanly', async () => {
        const hash = await hashPassword('CorrectHorse1');

        await expect(hashPassword('')).rejects.toThrow();
        await expect(hashPassword('A'.repeat(129))).rejects.toThrow();

        await expect(verifyPassword('', hash))
            .resolves.toEqual({ valid: false, needsUpgrade: false });
        await expect(verifyPassword('A'.repeat(129), hash))
            .resolves.toEqual({ valid: false, needsUpgrade: false });
        await expect(verifyPassword('CorrectHorse1', 'corrupted-hash'))
            .resolves.toEqual({ valid: false, needsUpgrade: false });
        await expect(verifyPassword(
            'CorrectHorse1', '$argon2id$v=19$m=9999999,t=99,p=1$c2FsdHNhbHQ$dGFndGFn'))
            .resolves.toEqual({ valid: false, needsUpgrade: false });
    });

    it('validates server-side password strength requirements', () => {
        expect(validatePasswordStrength('Abcdefg1')).toBeUndefined();
        expect(validatePasswordStrength('short1A')).toBeDefined();
        expect(validatePasswordStrength('alllowercase1')).toBeDefined();
        expect(validatePasswordStrength('ALLUPPERCASE1')).toBeDefined();
        expect(validatePasswordStrength('NoDigitsHere')).toBeDefined();
        expect(validatePasswordStrength(`Aa1${'x'.repeat(126)}`)).toBeDefined();
    });
});
