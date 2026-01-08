// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { DatePickerElement } from 'react-hook-form-mui/date-pickers';
import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

/**
 * The options we'll present to users when having to pick their gender.
 */
export const kGenderOptions = [
    { id: 'Female', label: 'Female' },
    { id: 'Male', label: 'Male' },
    { id: 'Other', label: 'Other' },
];

/**
 * Canonical form fields that, together, create the account information form. Shared across multiple
 * views in the authentication flow.
 */
export function RegisterForm() {
    return (
        <>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="firstName" label="First name" type="text"
                                  fullWidth size="small" required
                                  autoFocus autoComplete="given-name" />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="lastName" label="Last name" type="text"
                                  fullWidth size="small" required
                                  autoComplete="family-name" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
                <SelectElement name="gender" label="Gender" options={kGenderOptions}
                               fullWidth size="small" required />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
                { /* Note: not using <LocalDatePickerElement> because the value is manually
                     transformed in the submit function of <RegisterDialog>. */ }
                <DatePickerElement name="rawBirthdate" label="Date of birth"
                                   disableFuture disableHighlightToday openTo="year"
                                   inputProps={{ fullWidth: true, size: 'small' }}
                                   required />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="phoneNumber" label="Phone number" type="tel"
                                  fullWidth size="small" required
                                  autoComplete="tel" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="discordHandle" label="Discord handle"
                                  fullWidth size="small" />
            </Grid>
        </>
    );
}
