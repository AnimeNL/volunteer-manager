// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import crypto from 'node:crypto';

/**
 * Securely hashes the given |sha256Password|, considering the application's salt, so that it's
 * safe to store at rest. This function accepts a sha256 hash of the password rather than the real
 * password as the client should never send us a plaintext password in either case.
 *
 * Based on OWASP recommendations, scrypt is used to hash the passwords:
 * https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 * http://www.tarsnap.com/scrypt/scrypt.pdf
 *
 * @param sha256Password SHA256 hash of the password.
 * @return A promise that will be returned once the password has been hashed.
 */
export function securePasswordHash(sha256Password: string): string {
    if (!Object.hasOwn(process.env, 'APP_PASSWORD_SALT'))
        throw new Error('A salt must be known to the application in order for hashing to work.');

    return securePasswordHashWithSalt(sha256Password, process.env.APP_PASSWORD_SALT!);
}

/**
 * Securely hashes the given |sha256Password| considering the given |salt|.
 *
 * @param sha256Password SHA256 hash of the password.
 * @param salt The salt that should be considered when hashing the password.
 * @return A promise that will be returned once the password has been hashed.
 */
export function securePasswordHashWithSalt(sha256Password: string, salt: string): string {
    if (sha256Password.length !== /* length of a sha256 encoded string= */ 64)
        throw new Error('The given password must be a SHA256 hash already.');

    return securePasswordHashWithRequest({ sha256Password, salt });
}

/**
 * Request parameters for a scrypt hashing operation. Defaults will be used based on the OWASP
 * recommendations for most usage, but testing requires lower level interaction with the API.
 */
interface SecurePasswordHashRequest {
    /**
     * Length of the key that is to be derived from this request.
     */
    dkLen?: number;

    /**
     * The scrypt minimum CPU/memory cost parameter.
     */
    N?: number;

    /**
     * The scrypt parallelism parameter.
     */
    p?: number;

    /**
     * The scrypt blocksize parameter.
     */
    r?: number;

    /**
     * The salt that should be included in the hash.
     */
    salt: string;

    /**
     * The SHA256-encoded password that should be hashed.
     */
    sha256Password: string;
}

/**
 * Securely hashes the given |request| with the appropriate parameters. Primarily exists to enable
 * testing, actual application code should use `securePasswordHash` instead.
 *
 * @param request The secure password hashing request.
 * @return A promise that will be returned once the password has been hashed.
 */
export function securePasswordHashWithRequest(request: SecurePasswordHashRequest): string {
    const { sha256Password, salt } = request;

    const N = request.N ?? 2 ** 14;
    const r = request.r ?? 8;
    const p = request.p ?? 5;
    const dkLen = request.dkLen ?? /* 32 bytes, or 64 bytes when HEX-encoded= */ 32;

    const hash = crypto.scryptSync(sha256Password, salt, dkLen, {
        N, r, p,
        maxmem: Math.max(32 * 1024 * 1024, 256 * N * r),
    });
    return hash.toString('hex');
}
