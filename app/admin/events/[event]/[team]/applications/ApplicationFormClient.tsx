// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useFormContext } from '@components/proxy/react-hook-form-mui';

import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';

import { AutocompleteElementWithDisabledOptions, type AutocompleteElementWithDisabledOptionsProps, type AutocompleteOption }
    from '@app/admin/components/AutocompleteElementWithDisabledOptions';
import { ApplicationAvailabilityForm, ApplicationParticipationForm }
    from '@app/registration/[slug]/application/ApplicationParticipation';

/**
 * The <ApplicationFormClient> component wraps the application form on the client side.
 */
export function ApplicationFormClient<TValue extends AutocompleteOption>(
    props: AutocompleteElementWithDisabledOptionsProps<TValue, /* Multiple= */ false>)
{
    const { name, ...restProps } = props;

    const { watch } = useFormContext();
    const formOpen = !!watch(name);

    return (
        <>
            <Grid size={{ xs: 12 }}>
                <AutocompleteElementWithDisabledOptions name={name} {...restProps} />
            </Grid>
            <Grid size={{ xs: 12 }} sx={{ display: formOpen ? 'initial' : 'none' }}>
                <Collapse in={formOpen}>
                    <Grid container spacing={2}>
                        <ApplicationParticipationForm />
                        <ApplicationAvailabilityForm />
                    </Grid>
                </Collapse>
            </Grid>
        </>
    );
}
