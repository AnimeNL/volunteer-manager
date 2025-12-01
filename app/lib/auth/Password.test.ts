// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import crypto from 'node:crypto';
import {
    securePasswordHash,
    securePasswordHashWithSalt,
    securePasswordHashWithRequest } from './Password';

describe('Password', () => {
    function sha256(input: string): string {
        return crypto.createHash('sha256').update(input).digest('hex')
    }

    it('is able to derive the salt from the process environment', () => {
        expect(Object.hasOwn(process.env, 'APP_PASSWORD_SALT')).toBeFalsy();
        expect(() => securePasswordHash(sha256('changeme1234'))).toThrow();

        process.env.APP_PASSWORD_SALT = 'FirstSalt';
        expect(securePasswordHash(sha256('changeme1234')))
            .toEqual('ca21cf41529f899ba3e54d17691608525e28b78e1083b017764060d51532e30d');

        process.env.APP_PASSWORD_SALT = 'SecondSalt';
        expect(securePasswordHash(sha256('changeme1234')))
            .toEqual('02958588a2da8f47aa52c0332bcfaa0fe0e0b43c0fa6a7c80347d4709aa88b55');

        delete process.env.APP_PASSWORD_SALT;

        expect(() => securePasswordHash(sha256('changeme1234'))).toThrow();
    });

    it('is able to securely hash passwords given a salt', () => {
        const testVectors = [
            {
                plaintext: 'changeme1234',
                salt: 'FirstSalt',
                expected: 'ca21cf41529f899ba3e54d17691608525e28b78e1083b017764060d51532e30d',
            },
            {
                plaintext: 'changeme1234',
                salt: 'SecondSalt',
                expected: '02958588a2da8f47aa52c0332bcfaa0fe0e0b43c0fa6a7c80347d4709aa88b55',
            },
        ];

        expect(testVectors.length).toBeGreaterThan(0);

        for (const { plaintext, salt, expected } of testVectors) {
            const result = securePasswordHashWithSalt(sha256(plaintext), salt);
            expect(result).toEqual(expected);
        }
    });

    it('should pass the scrypt reference tests', () => {
        // Source: http://www.tarsnap.com/scrypt/scrypt.pdf
        const testVectors = [
            {
                password: '',
                salt: '',
                N: 16,
                r: 1,
                p: 1,
                dkLen: 64,

                expected: [
                    0x77, 0xd6, 0x57, 0x62, 0x38, 0x65, 0x7b, 0x20, 0x3b, 0x19, 0xca, 0x42, 0xc1,
                    0x8a, 0x04, 0x97, 0xf1, 0x6b, 0x48, 0x44, 0xe3, 0x07, 0x4a, 0xe8, 0xdf, 0xdf,
                    0xfa, 0x3f, 0xed, 0xe2, 0x14, 0x42, 0xfc, 0xd0, 0x06, 0x9d, 0xed, 0x09, 0x48,
                    0xf8, 0x32, 0x6a, 0x75, 0x3a, 0x0f, 0xc8, 0x1f, 0x17, 0xe8, 0xd3, 0xe0, 0xfb,
                    0x2e, 0x0d, 0x36, 0x28, 0xcf, 0x35, 0xe2, 0x0c, 0x38, 0xd1, 0x89, 0x06,
                ],
            },
            {
                password: 'password',
                salt: 'NaCl',
                N: 1024,
                r: 8,
                p: 16,
                dkLen: 64,

                expected: [
                    0xfd, 0xba, 0xbe, 0x1c, 0x9d, 0x34, 0x72, 0x00, 0x78, 0x56, 0xe7, 0x19, 0x0d,
                    0x01, 0xe9, 0xfe, 0x7c, 0x6a, 0xd7, 0xcb, 0xc8, 0x23, 0x78, 0x30, 0xe7, 0x73,
                    0x76, 0x63, 0x4b, 0x37, 0x31, 0x62, 0x2e, 0xaf, 0x30, 0xd9, 0x2e, 0x22, 0xa3,
                    0x88, 0x6f, 0xf1, 0x09, 0x27, 0x9d, 0x98, 0x30, 0xda, 0xc7, 0x27, 0xaf, 0xb9,
                    0x4a, 0x83, 0xee, 0x6d, 0x83, 0x60, 0xcb, 0xdf, 0xa2, 0xcc, 0x06, 0x40
                ],
            },
            {
                skip: true,  // remove to run this test, which takes ~2 seconds on a beefy machine

                password: 'pleaseletmein',
                salt: 'SodiumChloride',
                N: 16384,
                r: 8,
                p: 1,
                dkLen: 64,

                expected: [
                    0x70, 0x23, 0xbd, 0xcb, 0x3a, 0xfd, 0x73, 0x48, 0x46, 0x1c, 0x06, 0xcd, 0x81,
                    0xfd, 0x38, 0xeb, 0xfd, 0xa8, 0xfb, 0xba, 0x90, 0x4f, 0x8e, 0x3e, 0xa9, 0xb5,
                    0x43, 0xf6, 0x54, 0x5d, 0xa1, 0xf2, 0xd5, 0x43, 0x29, 0x55, 0x61, 0x3f, 0x0f,
                    0xcf, 0x62, 0xd4, 0x97, 0x05, 0x24, 0x2a, 0x9a, 0xf9, 0xe6, 0x1e, 0x85, 0xdc,
                    0x0d, 0x65, 0x1e, 0x40, 0xdf, 0xcf, 0x01, 0x7b, 0x45, 0x57, 0x58, 0x87
                ],
            },
            {
                skip: true,  // remove to run this test, which takes ~6 seconds on a beefy machine

                password: 'pleaseletmein',
                salt: 'SodiumChloride',
                N: 1048576,
                r: 8,
                p: 1,
                dkLen: 64,

                expected: [
                    0x21, 0x01, 0xcb, 0x9b, 0x6a, 0x51, 0x1a, 0xae, 0xad, 0xdb, 0xbe, 0x09, 0xcf,
                    0x70, 0xf8, 0x81, 0xec, 0x56, 0x8d, 0x57, 0x4a, 0x2f, 0xfd, 0x4d, 0xab, 0xe5,
                    0xee, 0x98, 0x20, 0xad, 0xaa, 0x47, 0x8e, 0x56, 0xfd, 0x8f, 0x4b, 0xa5, 0xd0,
                    0x9f, 0xfa, 0x1c, 0x6d, 0x92, 0x7c, 0x40, 0xf4, 0xc3, 0x37, 0x30, 0x40, 0x49,
                    0xe8, 0xa9, 0x52, 0xfb, 0xcb, 0xf4, 0x5c, 0x6f, 0xa7, 0x7a, 0x41, 0xa4
                ],
            }
        ];

        expect(testVectors.length).toBeGreaterThan(0);

        for (const { password, expected, skip, ...params } of testVectors) {
            if (skip)
                continue;

            const expectedString = Buffer.from(expected).toString('hex');
            const resultString = securePasswordHashWithRequest({
                sha256Password: password,
                ...params,
            });

            expect(resultString).toEqual(expectedString);
        }
    });

    it('is able to create valid sha256 hashes', () => {
        expect(sha256(''))
            .toEqual('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        expect(sha256('hello, world'))
            .toEqual('09ca7e4eaa6e8ae9c7d261167129184883644d07dfba7cbfbc4c8a2e08360d5b');
        expect(sha256('abc'))
            .toEqual('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        expect(sha256('ABC'))
            .toEqual('b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78');
    })
});
