// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { sealPasswordResetRequest, sealRegistrationRequest, unsealPasswordResetRequest,
    unsealRegistrationRequest } from './Tokens';

describe('Tokens', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('seals, unseals, and expires password reset requests after three hours', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

        const sealed = sealPasswordResetRequest({ id: 9001, token: 1234 });

        vi.advanceTimersByTime(3 * 3600_000 - 1000);
        expect(unsealPasswordResetRequest(sealed)).toEqual({ id: 9001, token: 1234 });

        vi.advanceTimersByTime(2_000);
        expect(() => unsealPasswordResetRequest(sealed)).toThrow(/expired/);
    });

    it('seals and unseals registration requests with and without redirectUrl', () => {
        const partial = sealRegistrationRequest({ id: 9001 });
        expect(unsealRegistrationRequest(partial)).toEqual({ id: 9001 });

        const full = sealRegistrationRequest({ id: 9001, redirectUrl: '/foo/bar' });
        expect(unsealRegistrationRequest(full)).toEqual({ id: 9001, redirectUrl: '/foo/bar' });

        expect(() => unsealRegistrationRequest('foobar')).toThrow();
    });
});
