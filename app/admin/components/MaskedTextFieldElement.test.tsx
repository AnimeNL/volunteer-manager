// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { FormContainer } from '@proxy/react-hook-form-mui';

import { MaskedTextFieldElement } from './MaskedTextFieldElement';

import { kMaskedSecret } from './MaskedSecret';

describe('MaskedTextFieldElement', () => {
    it('does not render a reveal button when no secretValue is provided', () => {
        render(
            <FormContainer defaultValues={{ apiKey: kMaskedSecret }}>
                <MaskedTextFieldElement name="apiKey" label="API Key" />
            </FormContainer>
        );

        const input = screen.getByLabelText<HTMLInputElement>('API Key');
        expect(input.value).toBe(kMaskedSecret);
        expect(screen.queryByRole('button', { name: 'Reveal secret value' })).toBeNull();
    });

    it('hides the secret by default and reveals it in a popover when clicked', async () => {
        render(
            <FormContainer defaultValues={{ apiKey: kMaskedSecret }}>
                <MaskedTextFieldElement name="apiKey" label="API Key" secretValue="s3cr3t-value" />
            </FormContainer>
        );

        const input = screen.getByLabelText<HTMLInputElement>('API Key');
        expect(input.value).toBe(kMaskedSecret);
        expect(screen.queryByText('s3cr3t-value')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Reveal secret value' }));

        expect(await screen.findByText('s3cr3t-value')).toBeTruthy();

        fireEvent.keyDown(screen.getByRole('presentation'), { key: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByText('s3cr3t-value')).toBeNull();
        });
    });

    it('preserves disabled input slotProps while still allowing root users to reveal', async () => {
        render(
            <FormContainer defaultValues={{ token: kMaskedSecret }}>
                <MaskedTextFieldElement
                    name="token" label="Access token"
                    slotProps={{ input: { disabled: true } }}
                    secretValue="oauth-access-token" />
            </FormContainer>
        );

        const input = screen.getByLabelText<HTMLInputElement>('Access token');
        expect(input.disabled).toBe(true);

        const revealButton = screen.getByRole<HTMLButtonElement>('button', {
            name: 'Reveal secret value',
        });
        expect(revealButton.disabled).toBe(false);

        fireEvent.click(revealButton);
        expect(await screen.findByText('oauth-access-token')).toBeTruthy();
    });
});
