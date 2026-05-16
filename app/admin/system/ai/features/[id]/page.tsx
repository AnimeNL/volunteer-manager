// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TextareaAutosizeElement } from 'react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { BackButtonGrid } from '@app/admin/components/BackButtonGrid';
import { Example } from './Example';
import { FormGrid } from '@app/admin/components/FormGrid';
import { HiddenInput } from '@components/HiddenInput';
import { TokenOverviewAlert } from '../../TokenOverviewAlert';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { updatePrompt } from '../../AiActions';

import * as prompts from '@lib/ai/prompts';

/**
 * This <AiFeaturesPromptPage> page lists the prompt and configuration for an individual feature
 * that can be changed using the control panel. Examples can be generated on the fly.
 */
export default async function AiFeaturesPromptPage(
    props: PageProps<'/admin/system/ai/features/[id]'>)
{
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const promptId = (await props.params).id;

    const promptInstances = Object.values(prompts).map(promptConstructor => new promptConstructor);
    const prompt = promptInstances.find(promptInstance => promptInstance.metadata.id === promptId);
    if (!prompt || 'hidden' in prompt.metadata)
        notFound();

    let exampleAction: ServerAction | undefined;
    switch (prompt.metadata.id) {
        // todo: provide specialised examples for relevant features
    }

    const settings = await readSettings([
        prompt.metadata.setting,
    ]);

    const defaultValues = {
        id: prompt.metadata.id,
        prompt: settings[prompt.metadata.setting],
    };

    return (
        <>
            <FormGrid action={updatePrompt} defaultValues={defaultValues}>
                <BackButtonGrid href="/admin/system/ai/features">
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
            { !!exampleAction &&
                <Example action={exampleAction} id={prompt.metadata.id} /> }
        </>
    );
}

export const metadata: Metadata = {
    title: 'Features | Artificial Intelligence | AnimeCon Volunteer Manager',
};
