// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Crypto } from '@peculiar/webcrypto';
import * as iron from 'iron-webcrypto';

/**
 * Prefer use of the Web Crypto implementation offered natively (in browsers & NodeJS v19+), fall
 * back to the implementation provided by the @peculiar/webcrypto package.
 */
const kWebCryptoImpl =
    (globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto : new Crypto();

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

    // @ts-ignore: ArrayBuffer -> ArrayBufferLike migration stuff
    return iron.seal(kWebCryptoImpl, data, password, {
        ...iron.defaults,
        ttl: ttl * /* milliseconds= */ 1000,
    });
}

/**
 * Unseals the given `sealedData` using the `password`. The sealed data is validated to never be
 * valid for longer than the given `ttl`.
 *
 * @param sealedData The string containing the sealed representation of the data.
 * @param password The password to unseal the data with. Must be at least 32 characters in length.
 * @param ttl The time to live for the data, indicated in seconds.
 * @returns The unsealed data of whatever type it was serialized as.
 */
export async function unseal(sealedData: string, password: string, ttl: number): Promise<unknown> {
    if (password.length < 32)
        throw new Error('The password used to unseal data must be at least 32 characters long.');

    // @ts-ignore: ArrayBuffer -> ArrayBufferLike migration stuff
    return iron.unseal(kWebCryptoImpl, sealedData, password, {
        ...iron.defaults,
        ttl: ttl * /* milliseconds= */ 1000,
    });
}
