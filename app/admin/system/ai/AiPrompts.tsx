// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import { type FieldValues, FormContainer, TextareaAutosizeElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { Section } from '@app/admin/components/Section';
import { SubmitCollapse } from '../../components/SubmitCollapse';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <AiPrompts> component.
 */
export interface AiPromptsProps {
    /**
     * The prompts that should be shown on this page.
     */
    prompts: {
        'gen-ai-prompt-del-a-rie-advies': string;
        'gen-ai-prompt-financial-insights': string;
    };
}

/**
 * The <AiPrompts> component lists capability-based prompts that aren't subject to personality and
 * context, but rather have their own prompt as a stand-alone feature.
 */
export function AiPrompts(props: AiPromptsProps) {
    const [ error, setError ] = useState<string>();
    const [ invalidated, setInvalidated ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const handleChange = useCallback(() => setInvalidated(true), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        try {
            const response = await callApi('put', '/api/ai/settings', {
                promptsFeatures: {
                    'gen-ai-prompt-del-a-rie-advies': data['gen-ai-prompt-del-a-rie-advies'],
                    'gen-ai-prompt-financial-insights': data['gen-ai-prompt-financial-insights'],
                },
            });

            if (response.success)
                setInvalidated(false);
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ /* no dependencies */ ]);

    return (
        <FormContainer defaultValues={props.prompts} onSuccess={handleSubmit}>
            <Section title="Intentions">
                <Grid container spacing={2}>
                    <Grid size={{ xs: 3 }}>
                        <Typography variant="subtitle2">
                            Del a Rie Advies
                        </Typography>
                        <Typography variant="body2">
                            Used for personalised advice issued by Del a Rie Advies.
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 9 }}>
                        <TextareaAutosizeElement name={'gen-ai-prompt-del-a-rie-advies'}
                                                 size="small" onChange={handleChange} fullWidth />
                    </Grid>

                    <Grid size={{ xs: 3 }}>
                        <Typography variant="subtitle2">
                            Financial insights
                        </Typography>
                        <Typography variant="body2">
                            Used for the "insights and predictions" feature available to financial
                            graphs.
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 9 }}>
                        <TextareaAutosizeElement name={'gen-ai-prompt-financial-insights'}
                                                 size="small" onChange={handleChange} fullWidth />
                    </Grid>
                </Grid>
                <SubmitCollapse error={error} loading={loading} open={invalidated} />
            </Section>
        </FormContainer>
    );
}
