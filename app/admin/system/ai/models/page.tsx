// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { SelectElement, SliderElement, TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { FormGrid } from '@app/admin/components/FormGrid';
import { GeminiModelSelect } from './GeminiModelSelect';
import { ModelPlayground } from './ModelPlayground';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kAiSupportedModelIdentifiers } from '@lib/integrations/genai/Models';

import * as actions from '../AiActions';

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
        'ai-setting-backend',
        'ai-setting-gemini-api-key',
        'ai-setting-image-model',
        'ai-setting-text-model',
        'ai-setting-candidate-count',
        'ai-setting-temperature',
        'ai-setting-top-k',
        'ai-setting-top-p',
    ]);

    const defaultValues = {
        imageModel: settings['ai-setting-image-model']
            ?? kAiSupportedModelIdentifiers['gemini-2.5-flash-image'],
        textModel: settings['ai-setting-text-model']
            ?? kAiSupportedModelIdentifiers['gemini-2.5-flash'],
        backend: settings['ai-setting-backend'],
        geminiApiKey: settings['ai-setting-gemini-api-key'],

        candidateCount: settings['ai-setting-candidate-count'] ?? 0,
        temperature: settings['ai-setting-temperature'] ?? 0,
        topK: settings['ai-setting-top-k'] ?? 0,
        topP: settings['ai-setting-top-p'] ?? 0,
    };

    return (
        <>
            <FormGrid action={actions.updateModelSettings} defaultValues={defaultValues}>
                <Grid size={{ xs: 12 }} sx={{ mb: -1 }}>
                    <Typography variant="h6">
                        Model selection
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <GeminiModelSelect name="imageModel" label="Image Generation Model" />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <GeminiModelSelect name="textModel" label="Text Generation Model" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="backend" label="Backend" size="small" fullWidth
                                   options={[
                                       { id: 'gemini', label: 'Google AI Studio' },
                                       { id: 'vertexai', label: 'VertexAI' },
                                   ]}/>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="geminiApiKey" label="Gemini API Key" size="small"
                                      fullWidth />
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
                    <SliderElement name="candidateCount" label="Candidate count" size="small"
                                   min={1} max={8} step={1} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SliderElement name="temperature" label="Temperature" size="small"
                                   min={0} max={2} step={0.05} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SliderElement name="topK" label="Top K" size="small" min={1} max={64} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SliderElement name="topP" label="Top P" size="small" min={0} max={1}
                                   step={0.05} />
                </Grid>
            </FormGrid>
            <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid size={{ xs: 12 }}>
                    <Divider />
                </Grid>
                <Grid size={{ xs: 12 }} sx={{ my: -1 }}>
                    <Typography variant="h6">
                        Model playground
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}
                      sx={{
                          backgroundColor: 'animecon.adminExampleBackground',
                          borderRadius: 1,
                          padding: 2,
                      }}>
                    <ModelPlayground label="Text generation prompt" model="text"
                                     serverAction={actions.executeModelPlayground} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}
                      sx={{
                          backgroundColor: 'animecon.adminExampleBackground',
                          borderRadius: 1,
                          padding: 2,
                      }}>
                    <ModelPlayground label="Image generation prompt" model="image" enableAttachment
                                     serverAction={actions.executeModelPlayground} />
                </Grid>
            </Grid>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Models | Artificial Intelligence | AnimeCon Volunteer Manager',
};
