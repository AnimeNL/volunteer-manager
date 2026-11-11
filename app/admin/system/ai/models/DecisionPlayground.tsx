// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { TextFieldElement, TextareaAutosizeElement } from '@components/proxy/react-hook-form-mui';

import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import type { ServerAction, ServerActionResult } from '@lib/serverAction';
import { FormGrid } from '@app/admin/components/FormGrid';
import { HiddenInput } from '@components/HiddenInput';

/**
 * State captured after executing a decision through `<DecisionPlayground>`.
 */
type DecisionPlaygroundState =
    | {
        type: 'noul';
        result: {
            type: 'noul';
            decision: boolean;
            noul: number;
            confidence: number;
        };
    }
    | {
        type: 'score';
        criteria: string[];
        result: {
            type: 'score';
            score: number;
            probabilities: number[];
            confidence: number;
        };
    };

/**
 * Props accepted by the `<DecisionPlayground>` component.
 */
interface DecisionPlaygroundProps {
    /**
     * The server action that should be executed to evaluate the decision.
     */
    serverAction: ServerAction;

    /**
     * Title displayed at the top of the playground card.
     */
    title: string;

    /**
     * Decision question type to evaluate.
     */
    type: 'noul' | 'score';
}

/**
 * Interactive playground card allowing administrators to evaluate `noul` and `score` questions
 * against the configured Gemini Decision API model.
 */
export function DecisionPlayground(props: DecisionPlaygroundProps) {
    const [ state, setState ] = useState<DecisionPlaygroundState | undefined>();

    const defaultValues = useMemo(() => ({ type: props.type }), [ props.type ]);

    const executeDecision = useCallback(async (formData: unknown): Promise<ServerActionResult> => {
        const response = await props.serverAction(formData);
        if (!response.success)
            return response;

        if ('decisionResult' in response && response.decisionResult) {
            if (response.decisionResult.type === 'noul') {
                setState({
                    type: 'noul',
                    result: response.decisionResult,
                });
            } else if (response.decisionResult.type === 'score') {
                setState({
                    type: 'score',
                    criteria: response.decisionCriteria ?? [],
                    result: response.decisionResult,
                });
            }
        }

        return { success: true };

    }, [ props.serverAction ]);

    return (
        <>
            <FormGrid action={executeDecision} callToAction="Execute" spacing={2}
                      defaultValues={defaultValues}>
                <Grid size={{ xs: 12 }} sx={{ my: -1 }}>
                    <HiddenInput name="type" />
                    <Typography variant="h6">
                        {props.title}
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextareaAutosizeElement name="context" label="Decision context" size="small"
                                             required fullWidth />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="instructions" label="Question / instructions"
                                      size="small" required fullWidth />
                </Grid>
                { props.type === 'noul' &&
                    <>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="truthy" label="Truthy criterion" size="small"
                                              fullWidth />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="falsy" label="Falsy criterion" size="small"
                                              fullWidth />
                        </Grid>
                    </> }
                { props.type === 'score' &&
                    <Grid size={{ xs: 12 }}>
                        <TextareaAutosizeElement name="criteria"
                                                 label="Criteria (one per line, at least 2)"
                                                 size="small" required fullWidth />
                    </Grid> }
            </FormGrid>
            <Collapse in={!!state}>
                <Box sx={{ backgroundColor: 'background.paper', borderRadius: 1, p: 1, mt: 2 }}>
                    <Typography component="p" variant="subtitle2">
                        Gemini decided:
                    </Typography>
                    { state?.type === 'noul' &&
                        <Typography variant="body2">
                            <strong>Decision:</strong> {String(state.result.decision)} (noul:{' '}
                            {state.result.noul.toFixed(2)}, confidence:{' '}
                            {state.result.confidence.toFixed(2)})
                        </Typography> }
                    { state?.type === 'score' &&
                        <>
                            <Typography variant="body2">
                                <strong>Score:</strong> {state.result.score.toFixed(2)}{' '}
                                (confidence: {state.result.confidence.toFixed(2)})
                            </Typography>
                            { state.criteria.map((criterion, index) =>
                                <Typography key={index} variant="body2" color="text.secondary">
                                    [{index}] {(state.result.probabilities[index] ?? 0).toFixed(2)}
                                    {' — '}
                                    {criterion}
                                </Typography> )}
                        </> }
                </Box>
            </Collapse>
        </>
    );
}
