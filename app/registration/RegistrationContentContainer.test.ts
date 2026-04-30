// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { RegistrationContentContainer } from './RegistrationContentContainer';

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}));

describe('RegistrationContentContainer', () => {
    it.skip('should list no active events when the environment has no assigned teams', async () => {
        const SyncRegistrationContentContainer = await RegistrationContentContainer({
            /* no props */
        });

        render(SyncRegistrationContentContainer);

        expect(screen.getByText(/Sign in/)).toBeDefined();
    });

    it.todo('should enable the visitor to create an account');

    it.todo('should enable the visitor to sign in to their account using a code');

    it.todo('should enable the visitor to sign in to their account using a passkey');

    it.todo('should enable the visitor to sign in to their account using a passcode');

    it.todo('should enable the visitor to recover their password');

    it.todo('should enable the visitor to sign out of their account');
});
