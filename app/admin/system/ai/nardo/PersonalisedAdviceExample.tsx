// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { SelectElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

import type { ServerAction } from '@lib/serverAction';
import { FormGrid } from '@app/admin/components/FormGrid';
import { GenerateButton } from '../GenerateButton';
import { MarkdownContainer } from '@app/components/Markdown/MarkdownContainer';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

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

    const [ generatedMessage, setGeneratedMessage ] = useState<React.ReactNode | undefined>();

    const handleClose = useCallback(() => setGeneratedMessage(undefined), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (formData: unknown) => {
        const response = await props.action(formData);
        if (response.success && 'markdown' in response)
            setGeneratedMessage(response.markdown);

        return response;

    }, [ props.action ]);

    return (
        <>
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
            <ResponsiveDialog open={!!generatedMessage} onClose={handleClose}
                              title="Del a Rie Advies says…">
                <MarkdownContainer variant="body2">
                    {generatedMessage}
                </MarkdownContainer>
            </ResponsiveDialog>
        </>
    );
}
