// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React, { useCallback, useMemo, useState } from 'react';

import { type FieldValues, FormContainer, SelectElement, TextareaAutosizeElement }
    from '@proxy/react-hook-form-mui';

import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { GeneratePromptDefinition } from '@app/api/ai/generatePrompt';
import { callApi } from '@lib/callApi';

import { kSupportedLanguages } from '@app/api/ai/languages';

/**
 * Options available for the language selection box.
 */
const kLanguageOptions = kSupportedLanguages.map(language => ({ id: language, label: language }));

/**
 * Props accepted by the <AiExplorer> component.
 */
interface AiExplorerProps {
    /**
     * Intention of this particular prompt, which will be added to the generated context.
     */
    intention: string;

    /**
     * Personality of the agent that will be writing the message.
     */
    personality: string;

    /**
     * System instructions that define what the prompt should do in the first place.
     */
    systemInstructions: string;

    /**
     * The type of prompt that should be generated; passed to the API.
     */
    type: string;
}

/**
 * The <AiExplorer> component allows prompts to be conveniently finetuned by having a single edit
 * environment for the common personality, the specific prompt and context for the prompt.
 */
export function AiExplorer(props: AiExplorerProps) {
    const [ error, setError ] = useState<string>();
    const [ loading, setLoading ] = useState<boolean>(false);

    type Prompt = GeneratePromptDefinition['response']['prompt'];
    const [ generatedPrompt, setGeneratedPrompt ] = useState<Prompt>();
    const [ generatedResult, setGeneratedResult ] =
        useState<{ subject?: string; message: string } | undefined>();

    const handleGenerate = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        try {
            const response = await callApi('post', '/api/ai/generate/:type', {
                type: props.type as any,
                language: data.language,

                approveVolunteer: {
                    userId: /* Ferdi= */ 3,
                    event: '2025',
                    team: 'stewards',
                },

                cancelParticipation: {
                    userId: /* Dylan= */ 100,
                    event: '2023',
                    team: 'hosts',
                },

                changeTeam: {
                    userId: /* Demi= */ 498,
                    event: '2024',
                    currentTeam: 'stewards',
                    updatedTeam: 'hosts',
                },

                reinstateParticipation: {
                    userId: /* Marciano= */ 30,
                    event: '2024',
                    team: 'stewards',
                },

                rejectVolunteer: {
                    userId: /* Björk= */ 396,
                    event: '2024',
                    team: 'crew',
                },

                remindParticipation: {
                    userId: /* Nienke= */ 24,
                    event: '2025',
                    team: 'crew',
                },

                overrides: {
                    intention: data.intention,
                    systemInstructions: data.systemInstructions,
                },
            });

            if (response.success) {
                setGeneratedPrompt(response.prompt);
                setGeneratedResult(response.result);
            } else {
                setError(response.error);
            }
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ props.type ]);

    const defaultValues = useMemo(() => ({
        intention: props.intention,
        language: 'English',
        personality: props.personality,
        systemInstructions: props.systemInstructions,
    }), [ props ]);

    return (
        <FormContainer defaultValues={defaultValues} onSuccess={handleGenerate}>
            <Paper sx={{ p: 2 }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 2 }}>
                        <Typography variant="subtitle2">
                            Personality
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 10 }}>
                        <TextareaAutosizeElement name="personality" size="small" fullWidth />
                    </Grid>

                    <Grid size={{ xs: 2 }}>
                        <Typography variant="subtitle2">
                            System instructions
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 10 }}>
                        <TextareaAutosizeElement name="systemInstructions" size="small" fullWidth />
                    </Grid>

                    <Grid size={{ xs: 2 }}>
                        <Typography variant="subtitle2">
                            Intention
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 10 }}>
                        <TextareaAutosizeElement name="intention" size="small" fullWidth />
                    </Grid>

                    <Grid size={{ xs: 2 }}>
                        <Typography variant="subtitle2">
                            Language
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 10 }}>
                        <SelectElement name="language" size="small" fullWidth
                                       options={kLanguageOptions} />
                    </Grid>

                    <Grid size={{ xs: 2 }}>{ /* ... */ }</Grid>
                    <Grid size={{ xs: 10 }}>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                            <Button startIcon={ <SmartToyIcon /> } loading={loading} type="submit"
                                    variant="outlined">
                                Generate responses
                            </Button>
                            {error &&
                                <Typography sx={{ color: 'error.main' }}>
                                    {error}
                                </Typography> }
                        </Stack>
                    </Grid>
                </Grid>
            </Paper>
            <Collapse in={!!generatedResult}>
                <Paper sx={{ p: 2, mt: 2 }}>
                    { generatedResult?.subject &&
                        <Typography variant="h5" sx={{ mb: 1 }}>
                            {generatedResult?.subject}
                        </Typography> }
                    <Typography sx={{ whiteSpace: 'pre-wrap', lineBreak: 'loose' }}>
                        {generatedResult?.message}
                    </Typography>
                </Paper>
            </Collapse>
            <Collapse in={!!generatedPrompt && !!generatedPrompt.params}>
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="h5" sx={{ mb: 1 }}>
                        Prompt input parameters
                    </Typography>
                    <Grid container rowSpacing={2}>
                        { Object.entries(generatedPrompt?.params || {}).map(([ key, value ]) =>
                            <React.Fragment key={key}>
                                <Grid size={{ xs: 2 }}>
                                    <strong>{key}</strong>:
                                </Grid>
                                <Grid size={{ xs: 10 }}>
                                    {value}
                                </Grid>
                            </React.Fragment> )}
                    </Grid>
                </Paper>
            </Collapse>
            <Collapse in={!!generatedPrompt && !!generatedPrompt.context}>
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="h5" sx={{ mb: 1 }}>
                        Prompt generated context
                    </Typography>
                    <Grid container rowSpacing={2}>
                        { Object.entries(generatedPrompt?.context || {}).map(([ key, value ]) =>
                            <React.Fragment key={key}>
                                <Grid size={{ xs: 2 }}>
                                    <strong>{key}</strong>:
                                </Grid>
                                <Grid size={{ xs: 10 }} sx={{ whiteSpace: 'pre-wrap',
                                                              overflowWrap: 'anyhere' }}>
                                    { JSON.stringify(value, undefined, /* space= */ 4) }
                                </Grid>
                            </React.Fragment> )}
                    </Grid>
                </Paper>
            </Collapse>
            <Collapse in={!!generatedPrompt && !!generatedPrompt.message.length}>
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="h5" sx={{ mb: 1 }}>
                        Prompt
                    </Typography>
                    <List dense>
                        {generatedPrompt?.message.map((line, index) =>
                            <ListItem key={index} disablePadding>
                                <ListItemIcon sx={{ minWidth: '40px' }}>
                                    <ArrowRightIcon />
                                </ListItemIcon>
                                <ListItemText>
                                    {line}
                                </ListItemText>
                            </ListItem> )}
                    </List>
                </Paper>
            </Collapse>
        </FormContainer>
    );
}
