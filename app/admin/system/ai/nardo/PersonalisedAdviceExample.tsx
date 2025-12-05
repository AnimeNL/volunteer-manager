// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { SelectElement } from 'react-hook-form-mui';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';

import type { ServerAction } from '@lib/serverAction';
import { FormGrid } from '@app/admin/components/FormGrid';
import { GenerateButton } from '../GenerateButton';
import { Markdown } from '@components/Markdown';

/**
 * Props accepted by the <PersonalisedAdviceExample> component.
 */
interface PersonalisedAdviceExampleProps {
    /**
     * The action that should be executed when advice is being requested.
     */
    action: ServerAction;

    /**
     * Pieces of advice that can be suggested by Del a Rie Advies.
     */
    advice: { id: number; label: string }[];

    /**
     * Events that can be selected. The first event will be selected as the default option.
     */
    events: { id: string; label: string }[];

    /**
     * Volunteers who participated in recent events, and can be selected as the audience.
     */
    volunteers: { id: number; label: string }[];

    /**
     * Unique ID of the user who is currently viewing this page.
     */
    userId: number;
}

/**
 * The <PersonalisedAdviceExample> component allows an administrator to see an example of the advice
 * that will be issued under specific circumstances. The piece of advice, audience and event can be
 * customised to project this in most significant situations.
 */
export function PersonalisedAdviceExample(props: PersonalisedAdviceExampleProps) {
    const defaultValues = useMemo(() => {
        const randomAdviceIndex = Math.floor(Math.random() * props.advice.length);
        return {
            advice: props.advice[randomAdviceIndex]?.id,
            event: props.events[0]?.id,
            volunteer: props.userId,
        };
    }, [ props.advice, props.events, props.userId ]);

    const [ generatedMessage, setGeneratedMessage ] = useState<string | undefined>();

    const handleClose = useCallback(() => setGeneratedMessage(undefined), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (formData: unknown) => {
        const response = await props.action(formData);
        if (response.success && 'message' in response)
            setGeneratedMessage(response.message);

        return response;

    }, [ props.action ]);

    return (
        <Box sx={{
            backgroundColor: 'animecon.adminExampleBackground',
            borderRadius: 1,
            padding: 2,
        }}>
            <FormGrid action={handleSubmit} defaultValues={defaultValues}
                      submitButtonSlot={
                          <Grid size={{ xs: 12 }} sx={{ pb: 2 }}>
                              <GenerateButton />
                          </Grid> }>
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="advice" label="Advice" fullWidth size="small"
                                   options={props.advice}
                                   sx={{ backgroundColor: 'background.paper' }} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="event" label="Event" fullWidth size="small"
                                   options={props.events}
                                   sx={{ backgroundColor: 'background.paper' }} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="volunteer" label="Volunteer" fullWidth size="small"
                                   options={props.volunteers}
                                   sx={{ backgroundColor: 'background.paper' }} />
                </Grid>
            </FormGrid>
            { !!generatedMessage &&
                <Dialog open onClose={handleClose} fullWidth>
                    <DialogTitle>
                        Del a Rie Advies says…
                    </DialogTitle>
                    <DialogContent sx={{ whiteSpace: 'pre-line' }}>
                        <Markdown defaultVariant="body2">{generatedMessage}</Markdown>
                    </DialogContent>
                    <DialogActions sx={{ pt: 0, mr: 2, mb: 2 }}>
                        <Button onClick={handleClose} variant="text">Close</Button>
                    </DialogActions>
                </Dialog> }
        </Box>
    );
}
