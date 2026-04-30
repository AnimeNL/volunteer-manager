// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import type { Environment } from '@lib/Environment';
import { LandingPage } from './LandingPage';

vi.mock('next/headers', () => ({
    headers: () => new Headers({ 'x-test-header': 'value' }),
    cookies: () => ({
        get: (name: string) => ({ name, value: 'mock-cookie' }),
    }),
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}));

const kEnvironment: Environment = {
    id: 9001,
    colours: {
        'dark': '#000000',
        'light': '#ffffff',
    },
    description: 'This is the landing page of the Volunteering Team.',
    domain: 'volunteering.team',
    purpose: 'LandingPage',
    teams: [

    ],
    title: 'Volunteering Team'
};

describe('LandingPage', () => {
    it('should list no active events when the environment has no assigned teams', async () => {
        const SyncLandingPage = await LandingPage({
            environment: kEnvironment,
            searchParams: Promise.resolve({ /* none */ }),
        });

        render(SyncLandingPage);

        expect(screen.getByText(kEnvironment.title)).toBeDefined();
        expect(screen.getByText(kEnvironment.description)).toBeDefined();

        expect(screen.getByText(/nothing happening right now/)).toBeDefined();
    });

    it.todo('should list active registration and schedule buttons when applicable');

    it.todo('should list secondary registration and schedule buttons when applicable');

    it.todo('should enable admin and statistics buttons for administrators');
});
