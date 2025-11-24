// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import Grid from '@mui/material/Grid';

import type { NextPageParams } from '@lib/NextRouterParams';
import { BackButtonGrid } from '@app/admin/components/BackButtonGrid';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import * as prompts from '@lib/ai/prompts';

/**
 * This page displays configuration, and provides the ability to try out an individual prompt. The
 * given |id| must exist in the communication prompt configuration, otherwise we'll 404.
 */
export default async function CommunicationPromptAiPage(props: NextPageParams<'id'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const promptId = (await props.params).id;

    const promptInstances = Object.values(prompts).map(promptConstructor => new promptConstructor);
    const prompt = promptInstances.find(promptInstance => promptInstance.metadata.id === promptId);
    if (!prompt)
        notFound();

    return (
        <Grid container>
            <BackButtonGrid href="/admin/system/ai/communication">
                Back to overview
            </BackButtonGrid>
            {prompt.metadata.label}
            { /* TODO: Page goes here */ }
        </Grid>
    );
}

export const metadata: Metadata = {
    title: 'Communication | Artificial Intelligence | AnimeCon Volunteer Manager',
};
