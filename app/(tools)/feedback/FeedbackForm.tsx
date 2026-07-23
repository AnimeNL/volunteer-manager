// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { type FieldValues, AutocompleteElement, FormContainer, TextFieldElement, TextareaAutosizeElement, useForm }
    from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

import { Markdown } from '@components/Markdown';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <FeedbackForm> component.
 */
interface FeedbackFormProps {
    /**
     * When available, introduction that should be shown at the top of the form.
     */
    content?: string;

    /**
     * Array of volunteers who participate in the latest event.
     */
    volunteers: {
        id: number;
        name: string;
        role: string;
        team: string;
    }[];
}

/**
 * The <FeedbackForm> component displays a form that allows volunteering leads to submit feedback
 * on behalf of one of our volunteers. It receives the list of volunteers who help us out already.
 */
export function FeedbackForm(props: FeedbackFormProps) {
    const form = useForm();

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ success, setSuccess ] = useState<boolean>(false);

    const handleReset = useCallback(() => {
        form.reset({
            volunteer: undefined,
            visitor: undefined,
            feedback: undefined,
        });
        setSuccess(false);
    }, [ form ]);

    const handleSubmit = useCallback(async (data: FieldValues) => {
        setError(undefined);
        setLoading(false);
        try {
            if (!data.volunteer && !data.visitor)
                throw new Error('Either a volunteer or a visitor name must be provided');
            if (!data.feedback || data.feedback.length < 5)
                throw new Error('Feedback must be at least five characters in length');

            const result = await callApi('post', '/api/event/schedule/feedback', {
                feedback: data.feedback,
                overrides: {
                    userId: data.volunteer,
                    name: data.visitor,
                },
            });

            if (!result.success)
                throw new Error(result.error || 'Unable to save the feedback in our database');
            else
                setSuccess(true);

        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ /* no dependencies */ ]);

    const volunteerOptions = useMemo(() => {
        return props.volunteers.map(volunteer => {
            return {
                id: volunteer.id,
                label: volunteer.name,
            }
        });
    }, [ props.volunteers ]);

    return (
        <>
            { !!props.content &&
                <Paper sx={{ p: 2 }}>
                    <Markdown>{props.content}</Markdown>
                </Paper> }
            <Collapse in={!!success} sx={{ mt: '-8px !important' }}>
                <Paper sx={{ p: 2, mt: 3 }}>
                    <Stack spacing={2}>
                        <Alert severity="success">
                            The feedback has been submitted successfully! Thank you!
                        </Alert>
                        <Button fullWidth color="success" variant="outlined" onClick={handleReset}>
                            Submit more feedback
                        </Button>
                    </Stack>
                </Paper>
            </Collapse>
            <Collapse in={!success} sx={{ mt: '-8px !important' }}>
                <FormContainer formContext={form} onSuccess={handleSubmit}>
                    <Paper sx={{ p: 2, mt: 4 }}>
                        <Grid container rowSpacing={2}>
                            <Grid size={{ xs: 5 }}>
                                <AutocompleteElement name="volunteer" label="Volunteer"
                                                    options={volunteerOptions} matchId
                                                    autocompleteProps={{
                                                        fullWidth: true,
                                                        size: 'small',
                                                    }} />
                            </Grid>
                            <Grid size={{ xs: 2 }} sx={{
                                alignContent: 'center',
                                textAlign: 'center'
                            }}>
                                or
                            </Grid>
                            <Grid size={{ xs: 5 }}>
                                <TextFieldElement name="visitor" label="Visitor"
                                                fullWidth size="small" />
                            </Grid>

                            <Grid size={{ xs: 12 }}>
                                <TextareaAutosizeElement name="feedback" label="Feedback" required
                                                        size="small" fullWidth />
                            </Grid>
                        </Grid>
                    </Paper>
                    <Collapse in={!!error}>
                        <Paper sx={{ p: 2, mt: 2 }}>
                            <Alert severity="error">
                                {error}
                            </Alert>
                        </Paper>
                    </Collapse>
                    <Paper sx={{ p: 2, mt: 2 }}>
                        <Button color="success" fullWidth type="submit" variant="contained"
                                loading={loading}>
                            Submit
                        </Button>
                    </Paper>
                </FormContainer>
            </Collapse>
        </>
    );
}
