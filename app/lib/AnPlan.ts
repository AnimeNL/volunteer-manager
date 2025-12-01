// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import crypto from 'node:crypto';

/**
 * Parameters accepted by the AnPlan request parser.
 */
type AnPlanParameters = Record<string, boolean | number | string>;

/**
 * Creates the cipher used to decrypt or encrypt the parameters, based on the set environment
 * variables. If the appropriate key and IV are not available then an exception will be thrown.
 */
function createCipher(mode: 'decrypt'): crypto.Decipheriv;
function createCipher(mode: 'encrypt'): crypto.Cipheriv;
function createCipher(mode: 'decrypt' | 'encrypt') {
    if (!Object.hasOwn(process.env, 'APP_ANPLAN_URL_KEY'))
        throw new Error('The AnPlan URL key must be defined in order to encrypt URLs.');
    if (!Object.hasOwn(process.env, 'APP_ANPLAN_URL_IV'))
        throw new Error('The AnPlan URL IV must be defined in order to encrypt URLs.');

    const key = Buffer.from(process.env.APP_ANPLAN_URL_KEY!, 'utf8');
    const iv = Buffer.from(process.env.APP_ANPLAN_URL_IV!, 'utf8');

    return mode === 'encrypt' ? crypto.createCipheriv('aes-128-cbc', key, iv)
                              : crypto.createDecipheriv('aes-128-cbc', key, iv);
}

/**
 * Decrypts the given `encryptedParameters` back to a plaintext representation.
 */
export function decryptParameters(encryptedParameters: string): AnPlanParameters {
    const encodedCiphertext = atob(encryptedParameters);

    const cipher = createCipher('decrypt');
    const plaintext = Buffer.concat([
        cipher.update(Buffer.from(encodedCiphertext, 'base64')), // note the double decoding
        cipher.final(),
    ]).toString('utf8');

    const searchParams = new URLSearchParams(plaintext);
    return Object.fromEntries(searchParams.entries());
}

/**
 * Encrypts the given `parameters` to use with AnPlan.
 */
export function encryptParameters(parameters: AnPlanParameters): string {
    const searchParams = new URLSearchParams();
    for (const [ key, value ] of Object.entries(parameters))
        searchParams.set(key, value.toString());

    const cipher = createCipher('encrypt');
    const plaintext = searchParams.toString();

    const encodedCiphertext = Buffer.concat([
        cipher.update(Buffer.from(plaintext, 'utf8')),
        cipher.final(),
    ]).toString('base64');

    return btoa(encodedCiphertext);  // note the double encoding
}

/**
 * Base URL to the AnPlan tool, here all (relative) links will be created to.
 */
const kBaseUrl = 'https://anplan.animecon.nl';

/**
 * Composes a link relative to the AnPlan base URL for the given `page` and `parameters`, which will
 * be encrypted and then doubly base64 encoded. This is not guaranteed to be a stable interface.
 */
function composeLink(page: string, parameters: AnPlanParameters): string {
    return `${kBaseUrl}/${page}?${encryptParameters(parameters)}`;
}

/**
 * Returns a direct link to the activity identified by `activityId` in AnPlan.
 */
export function getAnPlanActivityUrl(activityId: number): string {
    return composeLink('events', {
        action: 'show',
        id: activityId,
    });
}

/**
 * Returns a direct link to the activity identified by `areaId` in AnPlan.
 */
export function getAnPlanAreaUrl(areaId: number): string {
    return composeLink('floors', {
        action: 'show',
        id: areaId,
    });
}

/**
 * Returns a direct link to the location identified by `locationId` in AnPlan.
 */
export function getAnPlanLocationUrl(locationId: number): string {
    return composeLink('locations', {
        action: 'show',
        id: locationId,
    });
}

/**
 * Returns a direct link to the timeslot identified by `timeslotId` in AnPlan.
 */
export function getAnPlanTimeslotUrl(timeslotId: number): string {
    return composeLink('timeslots', {
        action: 'show',
        id: timeslotId,
    });
}
