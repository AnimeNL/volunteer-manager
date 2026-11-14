// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo } from 'react';

import type { FieldValues } from '@proxy/react-hook-form-mui';
import { Controller, TextFieldElement, TextareaAutosizeElement, useForm }
    from '@proxy/react-hook-form-mui';

import Autocomplete from '@mui/material/Autocomplete';
import Grid from '@mui/material/Grid';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import TextField from '@mui/material/TextField';

import type { ServerAction } from '@lib/serverAction';
import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '@app/admin/components/Section';

/**
 * Default field values that may be pre-populated in `<ComposeEmailSection>`.
 */
export interface ComposeEmailDefaultValues {
    recipient?: string;
    cc?: string;
    subject?: string;
    message?: string;
}

/**
 * Props accepted by the `<ComposeEmailSectionClient>` component.
 */
export interface ComposeEmailSectionClientProps {
    /**
     * Server Action invoked when the message is submitted.
     */
    action: ServerAction;

    /**
     * Optional default values to pre-populate the form fields with.
     */
    defaultValues?: ComposeEmailDefaultValues;

    /**
     * Known volunteer recipient suggestions formatted as `Name <email>`.
     */
    recipients: string[];

    /**
     * Title displayed in the section header.
     * @default "Compose message"
     */
    title?: string;
}

/**
 * Client-side form section that allows composing and sending an outbound e-mail message from an
 * inbox account, either as a new conversation or in the context of an existing thread.
 */
export function ComposeEmailSectionClient(props: ComposeEmailSectionClientProps) {
    const { action, defaultValues, recipients, title = 'Compose message' } = props;

    const resolvedDefaultValues = useMemo<FieldValues>(() => ({
        recipient: defaultValues?.recipient ?? '',
        cc: defaultValues?.cc ?? '',
        subject: defaultValues?.subject ?? '',
        message: defaultValues?.message ?? '',
    }), [
        defaultValues?.cc,
        defaultValues?.message,
        defaultValues?.recipient,
        defaultValues?.subject,
    ]);

    const form = useForm({ defaultValues: resolvedDefaultValues });

    const handleSubmit = useCallback(async (data: unknown) => {
        const result = await action(data);
        if (result.success)
            form.reset(resolvedDefaultValues);

        return result;
    }, [ action, form, resolvedDefaultValues ]);

    return (
        <Section icon={ <OutboxOutlinedIcon /> } title={title}>
            <FormGrid action={handleSubmit} callToAction="Send message"
                      defaultValues={resolvedDefaultValues} form={form}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                        name="recipient"
                        control={form.control}
                        rules={{ required: 'This field is required' }}
                        render={ ({ field, fieldState }) => (
                            <Autocomplete
                                forcePopupIcon
                                freeSolo
                                fullWidth
                                size="small"
                                options={recipients}
                                value={field.value || null}
                                inputValue={field.value ?? ''}
                                onChange={ (_event, newValue) => field.onChange(newValue ?? '') }
                                onInputChange={ (_event, newInputValue, reason) => {
                                    if (reason === 'input' || reason === 'clear')
                                        field.onChange(newInputValue);
                                } }
                                onBlur={field.onBlur}
                                renderInput={ params => (
                                    <TextField
                                        {...params}
                                        inputRef={field.ref}
                                        name={field.name}
                                        label="Recipient"
                                        required
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message} />
                                ) } />
                        ) } />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="cc" label="Cc" fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="subject" label="Subject" fullWidth size="small"
                                      required />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextareaAutosizeElement name="message" label="Message" size="small" minRows={3}
                                             required fullWidth />
                </Grid>
            </FormGrid>
        </Section>
    );
}
