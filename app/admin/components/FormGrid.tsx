// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';
import { useFormState } from 'react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { FormProvider, FormProviderContext, type FormProviderProps }
    from '@components/FormProvider';

/**
 * Props accepted by the <FormGrid> component.
 */
export interface FormGridProps extends FormProviderProps {
    /**
     * Text that should be displayed on the call-to-action button that will submit the form.
     * Defaults to "Save changes".
     */
    callToAction?: string;

    /**
     * Whether the form should be permamently invalidated.
     */
    invalidated?: boolean;

    /**
     * Spacing to apply to the grid. Defaults to two units (16 pixels).
     */
    spacing?: number;
}

/**
 * The <FormGridSection> component represents a MUI <Grid> surrounded by an HTML form tag, for which
 * the underlying behaviour is underpinned by our <FormProvider> implementation.
 */
export function FormGrid(props: React.PropsWithChildren<FormGridProps>) {
    const { callToAction, children, invalidated, spacing, ...formProviderProps } = props;

    return (
        <FormProvider {...formProviderProps}>
            <Grid container spacing={ spacing ?? 2 } sx={{ mb: -2 }}>
                {children}
                <InnerFormGrid callToAction={callToAction} invalidated={invalidated} />
            </Grid>
        </FormProvider>
    );
}

/**
 * The <InnerFormGrid> component provides the inner behaviour of a <FormGrid>. It's factored out
 * separately to give it access to both the form and the FormProvider contexts.
 */
function InnerFormGrid(props: { callToAction?: string; invalidated?: boolean }) {
    const formContext = useContext(FormProviderContext);
    const formState = useFormState();

    return (
        <Collapse in={!!formState.isDirty || !!props.invalidated} sx={{ width: '100%' }}>
            <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={1} alignItems="center"
                        sx={{
                            backgroundColor: 'animecon.adminSubmitBackground',
                            borderRadius: 2,
                            padding: 1,
                            mb: 2,
                        }}>
                    <Button variant="contained" type="submit" loading={!!formContext.isPending}>
                        { props.callToAction ?? 'Save changes' }
                    </Button>
                    { (!!formContext.result && !formContext.result.success) &&
                        <Alert severity="warning" sx={{
                            flexGrow: 1,
                            px: 1,
                            py: 0,
                            whiteSpace: 'pre-line'
                        }}>
                            { formContext.result.error || 'The changes could not be saved' }
                        </Alert> }
                </Stack>
            </Grid>
        </Collapse>
    );
}
