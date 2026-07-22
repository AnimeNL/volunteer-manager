// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { SelectElement, SliderElement, TextFieldElement }
    from '@components/proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import type { GeminiApi, TextGenerationThinkingLevel } from '@lib/integrations/genai/Client';
import { FormGrid } from '@app/admin/components/FormGrid';
import { GeminiIcon } from '@app/admin/components/icons/GeminiIcon';
import { GeminiModelSelect } from './GeminiModelSelect';
import { ModelPlayground } from './ModelPlayground';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kAiSupportedModelIdentifiers } from '@lib/integrations/genai/Models';

import * as actions from '../AiActions';

/**
 * Labels for the specific Gemini API that should be used by the system.
 */
const kGeminiApiOptions: { id: GeminiApi, label: string }[] = [
    { id: 'Gemini', label: 'Gemini' },
    { id: 'GeminiEnterprise', label: 'Gemini Enterprise' },
];

/**
 * Labels for the degree of thinking the model is expected to do.
 */
const kThinkingLevelOptions: { id: TextGenerationThinkingLevel, label: string }[] = [
    { id: 'minimal', label: 'Minimal' },
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
];

/**
 * The models page allows the administrator to configure which models should be used for different
 * use cases. There are only very few settings available, and there is a "test" button to, in real
 * time, verify whether the integrations are working as expected.
 */
export default async function ModelsAiPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const settings = await readSettings([
        'ai-setting-gemini-api-key',
        'ai-setting-gemini-api',
        'ai-setting-image-model',
        'ai-setting-text-model-high',
        'ai-setting-text-model-low',
        'ai-setting-text-model-medium',
        'ai-setting-temperature',
        'ai-setting-thinking-level',
        'ai-setting-top-p',
    ]);

    const kDefaultImageModel = kAiSupportedModelIdentifiers['gemini-2.5-flash-image'];
    const kDefaultTextModel = kAiSupportedModelIdentifiers['gemini-2.5-flash'];

    const defaultValues = {
        imageModel: settings['ai-setting-image-model'] ?? kDefaultImageModel,
        textModelHigh: settings['ai-setting-text-model-high'] ?? kDefaultTextModel,
        textModelLow: settings['ai-setting-text-model-low'] ?? kDefaultTextModel,
        textModelMedium: settings['ai-setting-text-model-medium'] ?? kDefaultTextModel,
        geminiApiKey: settings['ai-setting-gemini-api-key'],
        geminiApi: settings['ai-setting-gemini-api'],

        temperature: settings['ai-setting-temperature'] ?? 0,
        thinkingLevel: settings['ai-setting-thinking-level'] ?? 'medium',
        topP: settings['ai-setting-top-p'] ?? 0,
    };

    return (
        <>
            <Section icon={ <GeminiIcon /> } title="Models"
                     breadcrumbs={[
                        { label: 'System', href: '/admin/system' },
                        { label: 'AI', href: '/admin/system/ai' },
                        { label: 'Models' },
                     ]}>
                <SectionIntroduction>
                    We integrate with the Gemini APIs and have access to a broad variety of models,
                    each appropriate for different use cases.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <FormGrid action={actions.updateModelSettings} defaultValues={defaultValues}>
                    <Grid size={{ xs: 12 }} sx={{ my: -1 }}>
                        <Typography variant="h6">
                            Model selection
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <GeminiModelSelect name="imageModel" label="Image Generation Model" />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <GeminiModelSelect name="textModelHigh"
                                           label="Text Generation (high complexity)" />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <GeminiModelSelect name="textModelMedium"
                                           label="Text Generation (medium complexity)" />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <GeminiModelSelect name="textModelLow"
                                           label="Text Generation (low complexity)" />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="geminiApiKey" label="Gemini API Key" size="small"
                                           fullWidth type="password" />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Divider />
                    </Grid>

                    <Grid size={{ xs: 12 }} sx={{ my: -1 }}>
                        <Typography variant="h6">
                            Model configuration
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <SelectElement name="geminiApi" label="Gemini API" size="small" fullWidth
                                       options={kGeminiApiOptions} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <SelectElement name="thinkingLevel" label="Thinking level" size="small"
                                       fullWidth options={kThinkingLevelOptions} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <SliderElement name="temperature" label="Temperature" size="small"
                                       min={0} max={2} step={0.05} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <SliderElement name="topP" label="Top P" size="small" min={0} max={1}
                                       step={0.05} />
                    </Grid>
                </FormGrid>
            </Section>
            <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ padding: 2, height: '100%' }}>
                        <ModelPlayground label="Text generation prompt" model="text"
                                         serverAction={actions.executeModelPlayground} />
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ padding: 2, height: '100%' }}>
                        <ModelPlayground label="Image generation prompt" model="image"
                                         enableAttachment
                                         serverAction={actions.executeModelPlayground} />
                    </Paper>
                </Grid>
            </Grid>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Models | Artificial Intelligence | AnimeCon Volunteer Manager',
};
