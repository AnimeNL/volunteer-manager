// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import type { PasswordResetRequest } from './PasswordReset';
import { sealPasswordResetRequest, unsealPasswordResetRequest } from './PasswordReset';

describe('PasswordReset', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('should be able to seal and unseal password requests', async () => {
        const plaintextRequest: PasswordResetRequest = {
            id: 9001,
            token: 1234,
        };

        const sealedRequest = await sealPasswordResetRequest(plaintextRequest);
        const unsealedRequest = await unsealPasswordResetRequest(sealedRequest);
        expect(unsealedRequest).toEqual(plaintextRequest);
    });

    it('expires password reset requests after three hours', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

        const sealedRequest = await sealPasswordResetRequest({ id: 9001, token: 1234 });

        vi.advanceTimersByTime(3 * 3600_000 - 1000);
        await expect(unsealPasswordResetRequest(sealedRequest))
            .resolves.toEqual({ id: 9001, token: 1234 });

        vi.advanceTimersByTime(2_000);
        await expect(unsealPasswordResetRequest(sealedRequest)).rejects.toThrow(/expired/);
    });
});
