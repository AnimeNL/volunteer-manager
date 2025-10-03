// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import { type FieldValues, FormContainer, TextareaAutosizeElement, SelectElement,
    SliderElement } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import Skeleton from '@mui/material/Skeleton';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { VertexAISettings } from '@lib/integrations/vertexai/VertexAIClient';
import { PlaceholderPaper } from '../../components/PlaceholderPaper';
import { SubmitCollapse } from '../../components/SubmitCollapse';
import { callApi } from '@lib/callApi';

import { kVertexSupportedModels } from '@lib/integrations/vertexai/VertexSupportedModels';

export type { VertexAISettings };

/**
 * Example prompt that can be submitted from the integration page to test this API.
 */
const kExamplePrompt = `
    You are organising the volunteering teams for a convention named AnimeCon 2024. Write a brief
    email to tell your friend Fred, who applied to help out, that they unfortunately won't be able
    to help out this year because they applied on a Tuesday whereas we only accept applications
    that were submitted on Wednesday or Friday. Encourage them to try again next year.`;

/**
 * Props accepted by the <ServiceSettings> component.
 */
interface ServiceSettingsProps {
    /**
     * Settings at the initial rendering of this component. Can be updated by this component too.
     */
    settings: VertexAISettings;

    /**
     * To be called when the settings have changed.
     */
    onChange: (settings: VertexAISettings) => void;

    /**
     * To be called when the settings should be saved.
     */
    onSave: (settings: VertexAISettings) => Promise<void>;
}

/**
 * Settings for the Vertex AI service that can be configured. A save button will be shown when any
 * changes have been made, after which they will come into effect.
 */
function ServiceSettings(props: ServiceSettingsProps) {
    const { settings, onChange, onSave } = props;

    const [ error, setError ] = useState<string>();
    const [ loading, setLoading ] = useState<boolean>(false);

    const [ invalidated, setInvalidated ] = useState<boolean>(false);

    const onRequestSave = useCallback(async () => {
        setLoading(true);
        setError(undefined);

        try {
            await onSave(settings);
            setInvalidated(false);
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ onSave, settings ]);

    const onModelChange = useCallback((value: VertexAISettings['model']) => {
        setInvalidated(true);
        onChange({ ...settings, model: value });
    }, [ onChange, settings ]);

    const onTemperatureChange = useCallback((event: unknown, value: number | number[]) => {
        setInvalidated(true);
        onChange({ ...settings, temperature: Array.isArray(value) ? value[0] : value });
    }, [ onChange, settings ]);

    const onTokenLimitChange = useCallback((event: unknown, value: number | number[]) => {
        setInvalidated(true);
        onChange({ ...settings, tokenLimit: Array.isArray(value) ? value[0] : value });
    }, [ onChange, settings ]);

    const onTopKChange = useCallback((event: unknown, value: number | number[]) => {
        setInvalidated(true);
        onChange({ ...settings, topK: Array.isArray(value) ? value[0] : value });
    }, [ onChange, settings ]);

    const onTopPChange = useCallback((event: unknown, value: number | number[]) => {
        setInvalidated(true);
        onChange({ ...settings, topP: Array.isArray(value) ? value[0] : value });
    }, [ onChange, settings ]);

    const modelOptions = Object.values(kVertexSupportedModels).map(model => ({
        id: model,
        label: model,
    }));

    return (
        <FormContainer defaultValues={settings} onSuccess={onRequestSave}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                    <SelectElement name="model" label="Model" size="small" fullWidth
                                   onChange={onModelChange} options={modelOptions} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    { /* safety settings? */ }
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <SliderElement name="temperature" label="Temperature" size="small"
                                   min={0} max={1} step={0.05}
                                   onChangeCommitted={onTemperatureChange} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <SliderElement name="tokenLimit" label="Token limit" size="small"
                                   min={1} max={1024} step={1}
                                   onChangeCommitted={onTokenLimitChange} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <SliderElement name="topK" label="Top K" size="small"
                                   min={1} max={40} onChangeCommitted={onTopKChange} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <SliderElement name="topP" label="Top P" size="small"
                                   min={0} max={1} step={0.05} onChangeCommitted={onTopPChange} />
                </Grid>
            </Grid>
            <SubmitCollapse error={error} loading={loading} open={invalidated} sx={{ mt: 1 }} />
        </FormContainer>
    );
}

/**
 * Props accepted by the <InteractivePanel> component.
 */
interface InteractivePanelProps {
    /**
     * Callback that will be invoked when a prompt has been requested.
     */
    onRequest: (prompt: string) => Promise<void>;
}

/**
 * Panel that allows the administrator to see what the output of an example prompt would be. The
 * prompt is included as an input field in this panel, and can be activated as such.
 */
function InteractivePanel(props: InteractivePanelProps) {
    const [ loading, setLoading ] = useState<boolean>(false);

    const requestPrompt = useCallback(async (data: FieldValues) => {
        setLoading(true);
        try {
            await props.onRequest(data.prompt);
        } finally {
            setLoading(false);
        }
    }, [ props ]);

    const normalizedPrompt = kExamplePrompt.replaceAll(/\s{2,}/g, ' ').trim();

    return (
        <Paper sx={{ flexBasis: '100%', p: 2, minHeight: '150px' }}>
            <FormContainer defaultValues={{ prompt: normalizedPrompt }} onSuccess={requestPrompt}>
                <TextareaAutosizeElement size="small" fullWidth name="prompt" />
                <Stack direction="row" justifyContent="flex-end" sx={{ pt: 2 }}>
                    <Button startIcon={ <SmartToyIcon /> } loading={loading} variant="outlined"
                            type="submit">
                        Generate
                    </Button>
                </Stack>
            </FormContainer>
        </Paper>
    );
}

/**
 * Props accepted by the <InteractiveResponsePanel> component.
 */
interface InteractiveResponsePanelProps {
    /**
     * The response to display in the panel. Undefined means that it's still loading, and should not
     * be displayed as is yet.
     */
    response?: string;
}

/**
 * Panel that displays the response to the interactive panel's queries. This version of the panel
 * assumes that a response is (at least) being loaded, and thus supports a suspended state.
 */
function InteractiveResponsePanel(props: InteractiveResponsePanelProps) {
    const { response } = props;
    return (
        <Paper sx={{ flexBasis: '100%', p: 2 }}>
            { (!response) &&
                <>
                    <Skeleton variant="text" animation="wave" width="80%" height={16} />
                    <Skeleton variant="text" animation="wave" width="60%" height={16} />
                    <Skeleton variant="text" animation="wave" width="70%" height={16} />
                    <Skeleton variant="text" animation="wave" width="70%" height={16} />
                    <Skeleton variant="text" animation="wave" width="40%" height={16} />
                </> }
            <Collapse in={!!response}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {props.response}
                </Typography>
            </Collapse>
        </Paper>
    );
}

/**
 * Panel that is a placeholder for an interactive response panel, however for one that has not been
 * received yet. A placeholder panel is displayed instead, explaining that a result is pending.
 */
function InteractiveResponseIdlePanel() {
    return (
        <PlaceholderPaper sx={{ flexBasis: '100%' }}>
            <Stack direction="column" spacing={2} justifyContent="center" alignItems="center"
                   sx={{ color: 'text.disabled', height: '100%' }}>
                <PauseCircleOutlineIcon />
                <Typography variant="body2">
                    Waiting for a prompt to be submitted…
                </Typography>
            </Stack>
        </PlaceholderPaper>
    );
}

/**
 * Props for the <VertexAI> component.
 */
interface VertexAIProps {
    /**
     * The Vertex AI settings that apply while the page is being loaded. May be modified during this
     * component's lifetime, however changes can be tried out first.
     */
    settings: VertexAISettings;
}

/**
 * The <VertexAI> component represents our integration with the Google Vertex AI APIs, which we use
 * to generate personalised messages to volunteers. It encapsulates both the settings, used prompts
 * and authentication used to communicate with the service.
 */
export function VertexAI(props: VertexAIProps) {
    const [ settings, setSettings ] = useState<VertexAISettings>(props.settings);

    const [ loading, setLoading ] = useState<boolean>(false);
    const [ response, setResponse ] = useState<string>();

    const generateResponse = useCallback(async (prompt: string) => {
        setLoading(true);
        setResponse(undefined);

        try {
            const response = await callApi('post', '/api/admin/vertex-ai', {
                prompt,
                settings,
            });

            if (response.result)
                setResponse(response.result);

        } finally {
            setLoading(false);
        }

    }, [ settings ]);

    const updateSettings = useCallback((settings: VertexAISettings) => {
        setSettings(settings);
    }, [ /* no deps */ ]);

    const saveSettings = useCallback(async () => {
        await callApi('post', '/api/admin/update-integration', {
            vertexAi: settings,
        });
    }, [ settings ]);

    return (
        <>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h5" sx={{ pb: 1 }}>
                    Google Vertex AI
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                    This API is used to dynamically generate responses to volunteer applications, as
                    well as automated reminder e-mails as events come closer. Responses are
                    exclusively generated by express senior volunteer action, and are verified
                    before being sent out.
                </Alert>
                <ServiceSettings settings={props.settings} onChange={updateSettings}
                                 onSave={saveSettings} />
            </Paper>
            <Stack direction="row" spacing={2} alignItems="stretch">
                <InteractivePanel onRequest={generateResponse} />
                { (!loading && !response) && <InteractiveResponseIdlePanel /> }
                { (loading || response) && <InteractiveResponsePanel response={response} /> }
            </Stack>
        </>
    );
}
