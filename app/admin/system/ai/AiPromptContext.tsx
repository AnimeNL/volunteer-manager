// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import React, { useCallback, useMemo, useState } from 'react';

import { type FieldValues, FormContainer, TextareaAutosizeElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { Section } from '@app/admin/components/Section';
import { SubmitCollapse } from '../../components/SubmitCollapse';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <AiPromptContext> component.
 */
export interface AiPromptContextProps {
    /**
     * The intentions that should be displayed on this page.
     */
    intentions: {
        /**
         * Label, through which it should be indicated to the volunteer.
         */
        label: string;

        /**
         * The intention that's configured for this particular case.
         */
        intention: string;

        /**
         * Name of the setting, as it will be uploaded to the server.
         */
        setting: string;
    }[];
}

/**
 * The <AiPromptContext> component lists the context unique to each of the cases in which we'll use
 * generative AI to generate messages.
 */
export function AiPromptContext(props: AiPromptContextProps) {
    const { intentions } = props;

    const [ error, setError ] = useState<string>();
    const [ invalidated, setInvalidated ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const handleChange = useCallback(() => setInvalidated(true), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        try {
            const updates = Object.fromEntries(intentions.map(intention => ([
                intention.setting,
                data[intention.setting] ?? intention.intention ?? '',
            ])));

            const response = await callApi('put', '/api/ai/settings', {
                prompts: updates as any,
            });

            if (response.success)
                setInvalidated(false);
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ intentions ]);

    const defaultValues = useMemo(() => Object.fromEntries(intentions.map(intention => ([
        intention.setting,
        intention.intention,
    ]))), [ intentions ]);

    return (
        <FormContainer defaultValues={defaultValues} onSuccess={handleSubmit}>
            <Section title="Intentions">
                <Grid container spacing={2}>
                    { intentions.map(intention =>
                        <React.Fragment key={intention.setting}>
                            <Grid size={{ xs: 3 }}>
                                <Typography variant="subtitle2">
                                    {intention.label}
                                </Typography>
                                <Typography variant="body2">
                                    <MuiLink
                                        component={Link}
                                        href={`./ai/prompt/${intention.setting.substring(17)}`}>
                                        Explore prompt
                                    </MuiLink>
                                </Typography>
                            </Grid>
                            <Grid size={{ xs: 9 }}>
                                <TextareaAutosizeElement name={intention.setting} size="small"
                                                         onChange={handleChange} fullWidth />
                            </Grid>
                        </React.Fragment> )}
                </Grid>
                <SubmitCollapse error={error} loading={loading} open={invalidated} />
            </Section>
        </FormContainer>
    );
}
