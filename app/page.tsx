// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { LandingPage } from './welcome/LandingPage';
import { PlaceholderPage } from './welcome/PlaceholderPage';
import { determineEnvironment } from '@lib/Environment';
import { generatePortalMetadataFn } from './registration/generatePortalMetadataFn';

import { kEnvironmentPurpose } from '@lib/database/Types';

/**
 * The entry point of the AnimeCon Volunteer Manager. Determines what to do based on the purpose of
 * the current environment, when said environment could be identified.
 */
export default async function RootPage() {
    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    switch (environment.purpose) {
        case kEnvironmentPurpose.LandingPage:
            return <LandingPage environment={environment} />;
        case kEnvironmentPurpose.Placeholder:
            return <PlaceholderPage />;
    }

    notFound();
}

export const generateMetadata = generatePortalMetadataFn();