// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { seal, unseal } from './Iron';

describe('Iron', () => {
    it('verifies that a sufficiently long password is used', async () => {
        const invalidPassword = 'too-short';
        const validPassword = 'this-password-definitely-is-long-enough';

        await expect(seal(null, invalidPassword, 0)).rejects.toThrow();
        await expect(unseal('', invalidPassword)).rejects.toThrow();

        await expect(seal(null, validPassword, 0)).resolves.toMatch(/^Fe/);
    });

    it('can roundtrip data of various types', async () => {
        const password = 'F4y%8wsHR(,fRML4Dg;ilT4{H2J5sSf<';

        async function roundtrip(data: unknown) {
            const sealedData = await seal(data, password, 32);
            return await unseal(sealedData, password);
        }

        await expect(roundtrip(null)).resolves.toEqual(null);
        await expect(roundtrip(true)).resolves.toEqual(true);
        await expect(roundtrip(false)).resolves.toEqual(false);

        await expect(roundtrip(3.1415)).resolves.toEqual(3.1415);
        await expect(roundtrip('hello, world')).resolves.toEqual('hello, world');
        await expect(roundtrip({ value: 42 })).resolves.toEqual({ value: 42 });
    });

    it('can roundtrip data with various passwords', async () => {
        const plaintext = { fruit: 'banana' };

        const firstPassword = '0ySycf@=slZNkn.R9zX.n+OL2+H<=YQW';
        const firstSealedData = await seal(plaintext, firstPassword, 32);

        const secondPassword = '{?cDE+yN=MupSGXpel0GAR0#*%jaLanj';
        const secondSealedData = await seal(plaintext, secondPassword, 32);

        await expect(firstSealedData).not.toEqual(secondSealedData);
        await expect(unseal(firstSealedData, firstPassword)).resolves.toEqual(plaintext);
        await expect(unseal(firstSealedData, secondPassword)).rejects.toThrow(/Invalid HMAC/);

        await expect(unseal(secondSealedData, firstPassword)).rejects.toThrow(/Invalid HMAC/);
        await expect(unseal(secondSealedData, secondPassword)).resolves.toEqual(plaintext);
    });

    it('rejects sealed data when the signature salt cannot be validated', async () => {
        const password = 'dy`GEpO!o0\\V7/$96a!1jT_6e0wA)!hr';
        const plaintext = 'Hello, world!';

        const sealedData = await seal(plaintext, password, 32);
        const sealedDataParts = sealedData.split('*');

        expect(sealedDataParts).toHaveLength(8);
        expect(sealedDataParts[6].length).greaterThan(8);

        // Index [6] is the signature's salt:
        sealedDataParts[6] = sealedDataParts[6].split('').reverse().join('');

        const invalidatedSealedData = sealedDataParts.join('*');

        await expect(unseal(sealedData, password)).resolves.toEqual(plaintext);
        await expect(unseal(invalidatedSealedData, password)).rejects.toThrow(/has been broken/);
    });

    it('rejects sealed data when the signature digest cannot be validated', async () => {
        const password = '$84H&0t8WI/cH0+*<{t7w£2[Bo:4-_==';
        const plaintext = 'Hello, world!';

        const sealedData = await seal(plaintext, password, 32);
        const sealedDataParts = sealedData.split('*');

        expect(sealedDataParts).toHaveLength(8);
        expect(sealedDataParts[7].length).greaterThan(12);

        // Index [7] is the signature's digest:
        sealedDataParts[7] = sealedDataParts[7].split('').reverse().join('');

        const invalidatedSealedData = sealedDataParts.join('*');

        await expect(unseal(sealedData, password)).resolves.toEqual(plaintext);
        await expect(unseal(invalidatedSealedData, password)).rejects.toThrow(/has been broken/);
    });

    it('rejects sealed data when the expiration time is in the past', async () => {
        const password = '$18hDY8xI4t2cqLI;4sKu4(38wGsh+F^';
        const plaintext = 'Hello, world!';

        vi.setSystemTime(Date.now() - 10_000_000);

        const sealedData = await seal(plaintext, password, 32);
        const sealedDataParts = sealedData.split('*');

        vi.setSystemTime(vi.getRealSystemTime());

        expect(sealedDataParts).toHaveLength(8);

        // Index [5] is the expiration time:
        expect(sealedDataParts[5].length).greaterThan(8);
        expect(sealedDataParts[5]).toMatch(/^\d+/);

        const sealedDataExpirationTime = parseInt(sealedDataParts[5], /* radix= */ 10);
        expect(sealedDataExpirationTime).toBeLessThan(Date.now());

        await expect(unseal(sealedData, password)).rejects.toThrow(/in the past/);
    });
});
