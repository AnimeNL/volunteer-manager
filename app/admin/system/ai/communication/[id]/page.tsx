// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TextareaAutosizeElement } from 'react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import type { NextPageParams } from '@lib/NextRouterParams';
import { BackButtonGrid } from '@app/admin/components/BackButtonGrid';
import { Example } from './Example';
import { FormGrid } from '@app/admin/components/FormGrid';
import { HiddenInput } from '@components/HiddenInput';
import { TokenOverviewAlert } from '../../TokenOverviewAlert';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import * as actions from '../../AiActions';
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
    if (!prompt || 'hidden' in prompt.metadata)
        notFound();

    const settings = await readSettings([
        prompt.metadata.setting,
    ]);

    const defaultValues = {
        id: prompt.metadata.id,
        prompt: settings[prompt.metadata.setting],
    };

    return (
        <>
            <FormGrid action={actions.updatePrompt} defaultValues={defaultValues}>
                <BackButtonGrid href="/admin/system/ai/communication">
                    Back to overview
                </BackButtonGrid>
                <Grid size={{ xs: 12 }} sx={{ mt: -1 }}>
                    <Divider />
                </Grid>
                <Grid size={{ xs: 12 }} sx={{ mt: -2 }}>
                    <Typography variant="h6" sx={{ pb: 1 }}>
                        {prompt.metadata.label}
                    </Typography>
                    <TokenOverviewAlert prompt={prompt} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <HiddenInput name="id" />
                    <TextareaAutosizeElement name="prompt" label="Prompt template" size="small"
                                             fullWidth />
                </Grid>
            </FormGrid>
            <Divider sx={{ mt: 2 }} />
            <Example id={prompt.metadata.id} />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Communication | Artificial Intelligence | AnimeCon Volunteer Manager',
};
