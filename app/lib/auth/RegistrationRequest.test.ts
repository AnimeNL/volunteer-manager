// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { RegistrationRequest } from './RegistrationRequest';
import { sealRegistrationRequest, unsealRegistrationRequest } from './RegistrationRequest';

describe('RegistrationRequest', () => {
    it('should be able to seal and unseal registration requests', async () => {
        // (1) Partial requests
        {
            const plaintextRequest: RegistrationRequest = {
                id: 9001,
            };

            const sealedRequest = await sealRegistrationRequest(plaintextRequest);
            const unsealedRequest = await unsealRegistrationRequest(sealedRequest);

            expect(unsealedRequest).toEqual(plaintextRequest);
        }

        // (2) Complete requests
        {
            const plaintextRequest: RegistrationRequest = {
                id: 9001,
                redirectUrl: '/foo/bar',
            };

            const sealedRequest = await sealRegistrationRequest(plaintextRequest);
            const unsealedRequest = await unsealRegistrationRequest(sealedRequest);

            expect(unsealedRequest).toEqual(plaintextRequest);
        }
    });

    it('should throw on invalid or expired requests', async () => {
        await expect(unsealRegistrationRequest('foobar')).rejects.toThrow();
    });
});
