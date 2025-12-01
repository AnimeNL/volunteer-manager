// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * This implementation is extracted from iron-webcrypto, which in itself is based on @hapi/iron.
 * Initially we benefitted from a WebCrypto fallback, but with modern versions of Node.js this no
 * longer is required, and we can implement the data marshalling to WebCrypto ourselves.
 *
 * @see https://www.npmjs.com/package/iron-webcrypto
 * @see https://www.npmjs.com/package/@hapi/iron
 */

// -------------------------------------------------------------------------------------------------

/**
 * Prefix indicating that this is our packaging format.
 */
const kPrefix = 'Fe26.2';

/**
 * Utilities to convert between Uint8Array instances and base64/hex strings.
 * @todo Adopt https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toHex
 */
const base64ToUint8Array = (data: string) => Buffer.from(data, 'base64');
const uint8ArrayToBase64 = (data: Uint8Array<ArrayBuffer>) => Buffer.from(data).toString('base64');
const uint8ArrayToHex = (data: Uint8Array<ArrayBuffer>) => Buffer.from(data).toString('hex');

/**
 * File-global instances of the default text encoder and decoder.
 */
const kTextEncoder = new TextEncoder();
const kTextDecoder = new TextDecoder();

/**
 * Seals the given `data` using the `password`. The sealed data will be valid for, at most, the
 * number of seconds indicated in the `ttl`.
 *
 * @param data The data that should be sealed, generally an object.
 * @param password The password to seal the data with. Must be at least 32 characters in length.
 * @param ttl The time to live for the data, indicated in seconds.
 * @returns A string contained the sealed representation of the data.
 */
export async function seal(data: unknown, password: string, ttl: number): Promise<string> {
    if (password.length < 32)
        throw new Error('The password used to seal data must be at least 32 characters long.');

    const encodedData = kTextEncoder.encode(JSON.stringify(data));

    const key = await generateKey('aes-256-cbc', password);
    const iv = await generateBits(/* ivBits= */ 128);

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key.key, encodedData);

    const macBaseString = [
        kPrefix,
        /* password id= */ '',
        /* encryption salt= */ key.salt,
        /* encryption iv= */ uint8ArrayToBase64(iv),
        /* encryption data= */ uint8ArrayToBase64(new Uint8Array(encrypted)),
        /* expiration time= */ Date.now() + ttl * 1000,

    ].join('*');

    const integrityKey = await generateKey('sha-256', password);
    const integritySignature =
        await crypto.subtle.sign('HMAC', integrityKey.key, kTextEncoder.encode(macBaseString));

    return [
        macBaseString,
        /* integrity salt= */ integrityKey.salt,
        /* integrity digest= */ uint8ArrayToBase64(new Uint8Array(integritySignature)),

    ].join('*');
}

/**
 * Unseals the given `sealedData` using the `password`. The sealed data is validated to never be
 * valid for longer than the given `ttl`.
 *
 * @param sealedData The string containing the sealed representation of the data.
 * @param password The password to unseal the data with. Must be at least 32 characters in length.
 * @returns The unsealed data of whatever type it was serialized as.
 */
export async function unseal(sealedData: string, password: string): Promise<unknown> {
    if (password.length < 32)
        throw new Error('The password used to unseal data must be at least 32 characters long.');

    const parts = sealedData.split('*');
    if (parts.length !== 8)
        throw new Error(`Invalid number of sealed components (expected 8, got ${parts.length})`);

    const [ prefix, _, encryptionSalt, encryptionIv, encryptionData, expiration, integritySalt,
        integrityDigest ] = parts;

    // (1) Prefix validation
    if (prefix !== kPrefix)
        throw new Error(`Invalid prefix (expected "${kPrefix}", got "${prefix}")`);

    // (2) Expiration time validation
    {
        if (!/^[1-9]\d*$/.test(expiration))
            throw new Error(`Invalid expiration time (expected a number, got "${expiration})`);

        const expirationTime = parseInt(expiration, /* radix= */ 10);
        if (expirationTime < Date.now())
            throw new Error(`Invalid expiration time (in the past)`);
    }

    // (3) Verify the signature
    {
        const key = await generateKey('sha-256', password, integritySalt);
        const macBaseString = parts.slice(0, 6).join('*');

        const verify = await crypto.subtle.verify(
            'HMAC', key.key, base64ToUint8Array(integrityDigest),
            kTextEncoder.encode(macBaseString));

        if (!verify)
            throw new Error(`Invalid HMAC integrity digest, seal has been broken`);
    }

    // (4) Decrypt the data
    const key = await generateKey('aes-256-cbc', password, encryptionSalt);
    const decrypted = await crypto.subtle.decrypt({
        name: 'AES-CBC',
        iv: base64ToUint8Array(encryptionIv),
    }, key.key, base64ToUint8Array(encryptionData));

    const decryptedString = kTextDecoder.decode(decrypted);
    return JSON.parse(decryptedString);
}

/**
 * Generates cryptographically strong pseudorandom bits.
 *
 * @param bits Number of bits to generate (must be a positive multiple of 8).
 * @returns Uint8Array containing the random bits.
 */
async function generateBits(bits: number) {
    return crypto.getRandomValues(new Uint8Array(bits / 8));
}

/**
 * Generates a key based on the given |password|, using |type| to deriviate it.
 *
 * @param type Type of derived key to generate.
 * @param password The password string.
 * @param salt The salt to use. Optional.
 * @returns The derived key and the used salt.
 */
async function generateKey(type: 'aes-256-cbc' | 'sha-256', password: string, useSalt?: string) {
    const encodedPassword = kTextEncoder.encode(password);
    const salt = useSalt ?? uint8ArrayToHex(await generateBits(/* saltBits= */ 256));

    const algorithm = {
        name: 'PBKDF2',
        salt: kTextEncoder.encode(salt),
        iterations: 1,
        hash: 'SHA-1'
    };

    let derivedKeyUsage: KeyUsage[];
    let derivedKeyParams: AesDerivedKeyParams | HmacImportParams;

    switch (type) {
        case 'aes-256-cbc':
            derivedKeyUsage = [ 'encrypt', 'decrypt' ];
            derivedKeyParams = {
                name: 'AES-CBC',
                length: 256
            };
            break;

        case 'sha-256':
            derivedKeyUsage = [ 'sign', 'verify' ];
            derivedKeyParams = {
                name: 'HMAC',
                hash: 'SHA-256',
                length: 256
            };
            break;

        default:
            throw new Error(`Invalid derived key type: ${type}`);
    }

    const baseKey =
        await crypto.subtle.importKey('raw', encodedPassword, 'PBKDF2', false, [ 'deriveKey' ]);

    const derivedKey =
        await crypto.subtle.deriveKey(
            algorithm, baseKey, derivedKeyParams, /* extractable= */ false, derivedKeyUsage);

    return { key: derivedKey, salt };
}
