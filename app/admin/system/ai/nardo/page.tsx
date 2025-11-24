// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { TextareaAutosizeElement } from 'react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { FormGrid } from '@app/admin/components/FormGrid';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import * as actions from '../AiActions';
import { NardoPersonalisedAdvicePrompt } from '@lib/ai/prompts/NardoPersonalisedAdvice';

/**
 * The AI page contains the prompt configuration used for our use of Generative AI throughout the
 * volunteer portal. The page is protected behind a special permission.
 */
export default async function NardoAiPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const personalisedAdvicePrompt = new NardoPersonalisedAdvicePrompt();
    const personalisedAdviceParameters =
        [ ...personalisedAdvicePrompt.parameters ].sort().map(param => `{{${param}}}`);

    const settings = await readSettings([
        personalisedAdvicePrompt.metadata.setting,
    ]);

    const defaultValues = {
        personalisedAdvice: settings[personalisedAdvicePrompt.metadata.setting],
    };

    return (
        <FormGrid action={actions.updateNardo} defaultValues={defaultValues}>
            <Grid size={{ xs: 12 }} sx={{ mb: -1 }}>
                <Typography variant="h6">
                    Personalised Advice
                </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Available tokens: {personalisedAdviceParameters.join(', ')}
                </Alert>
                <TextareaAutosizeElement name="personalisedAdvice" label="Personalised advice"
                                         size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
                TODO (Example)
            </Grid>
        </FormGrid>
    );
}

export const metadata: Metadata = {
    title: 'Del a Rie Advies | Artificial Intelligence | AnimeCon Volunteer Manager',
};
