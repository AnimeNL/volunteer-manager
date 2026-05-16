// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SelectElement, TextareaAutosizeElement } from 'react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import type { TextGenerationComplexity } from '@lib/integrations/genai/Client';
import { BackButtonGrid } from '@app/admin/components/BackButtonGrid';
import { Example } from './Example';
import { FormGrid } from '@app/admin/components/FormGrid';
import { HiddenInput } from '@components/HiddenInput';
import { TokenOverviewAlert } from '../../TokenOverviewAlert';
import { executePromptWithExampleParameters } from '@lib/ai/Actions';
import { readSettings, type Setting } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { updatePrompt } from '../../AiActions';

import { kAiSupportedModels, type AiSupportedModel } from '@lib/integrations/genai/Models';

import * as prompts from '@lib/ai/prompts';

/**
 * Gets a model label for the given `model` that will be used for the given `complexity`.
 */
function getModelLabelForComplexity(complexity: string, model: AiSupportedModel) {
    if (!Object.hasOwn(kAiSupportedModels, model))
        return complexity;

    return `${complexity} (${kAiSupportedModels[model].name})`;
}

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

    let settingComplexity: Setting | undefined;
    if ('settingComplexity' in prompt.metadata)
        settingComplexity = prompt.metadata.settingComplexity;

    const settings = await readSettings([
        'ai-setting-text-model-high',
        'ai-setting-text-model-low',
        'ai-setting-text-model-medium',
        prompt.metadata.setting,
        settingComplexity!,
    ]);

    const complexityOptions: { id: TextGenerationComplexity, label: string }[] = [
        {
            id: 'low',
            label: getModelLabelForComplexity('Low', settings['ai-setting-text-model-low']!),
        },
        {
            id: 'medium',
            label: getModelLabelForComplexity('Medium', settings['ai-setting-text-model-medium']!),
        },
        {
            id: 'high',
            label: getModelLabelForComplexity('High', settings['ai-setting-text-model-high']!),
        },
    ];

    const defaultValues = {
        id: prompt.metadata.id,
        prompt: settings[prompt.metadata.setting],
        complexity: settings[settingComplexity!],
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
                { !!settingComplexity &&
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="complexity" label="Prompt complexity" size="small"
                                       fullWidth options={complexityOptions} />
                    </Grid> }
            </FormGrid>
            <Divider sx={{ mt: 2 }} />
            <Example action={executePromptWithExampleParameters} id={prompt.metadata.id} />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Features | Artificial Intelligence | AnimeCon Volunteer Manager',
};
