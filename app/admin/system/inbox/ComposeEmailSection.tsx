// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo } from 'react';

import type { FieldValues } from '@proxy/react-hook-form-mui';
import { TextFieldElement, TextareaAutosizeElement, useForm } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';

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
 * Props accepted by the `<ComposeEmailSection>` component.
 */
export interface ComposeEmailSectionProps {
    /**
     * Server Action invoked when the message is submitted.
     */
    action: ServerAction;

    /**
     * Optional default values to pre-populate the form fields with.
     */
    defaultValues?: ComposeEmailDefaultValues;

    /**
     * Title displayed in the section header.
     * @default "Compose message"
     */
    title?: string;
}

/**
 * Shared form section that allows composing and sending an outbound e-mail message from an inbox
 * account, either as a new conversation or in the context of an existing thread.
 */
export function ComposeEmailSection(props: ComposeEmailSectionProps) {
    const { action, defaultValues, title = 'Compose message' } = props;

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
                    <TextFieldElement name="recipient" label="Recipient" fullWidth size="small"
                                      required />
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
