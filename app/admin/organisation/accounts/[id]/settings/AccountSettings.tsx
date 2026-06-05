// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { CheckboxElement, TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AccountSettingsData } from '../AccountActions';

/**
 * Maximum number of examples messages that can be provided by the user.
 */
const kExampleMessageCount = 5;

/**
 * Type that defines the settings that should be made available when dealing with account settings.
 */
export type AccountSettings = AccountSettingsData;

/**
 * Props accepted by the <AccountSettingsForm> component.
 */
interface AccountSettingsFormProps {
    /**
     * Whether the form should be displayed in read-only mode, i.e. submission should be disabled.
     */
    readOnly?: boolean;
}

/**
 * The <AccountSettingsForm> component displays a set of settings owned by a particular account.
 * Such settings will be stored in UserSettings.
 */
export function AccountSettingsForm(props: AccountSettingsFormProps) {
    return (
        <>

            <Grid size={{ xs: 3 }}>
                <Typography variant="subtitle2" sx={{ pt: 0 }}>
                    Example messages
                </Typography>
                <Typography variant="body2">
                    Include three to five examples of e-mail messages you've written to help AI do
                    a better job for you. Includes messages in both Dutch and English.
                </Typography>
            </Grid>
            <Grid size={{ xs: 9 }}>
                <Stack direction="column" spacing={2}>
                    { Array(kExampleMessageCount).fill(null).map((_, index) =>
                        <TextFieldElement key={index} name={`exampleMessages[${index}]`}
                                          label={`Example message ${index + 1}`}
                                          fullWidth size="small"
                                          slotProps={{ input: { readOnly: !!props.readOnly } }}/> )}
                </Stack>
            </Grid>

            <Grid size={{ xs: 12 }}><Divider /></Grid>

            <Grid size={{ xs: 3 }}>
                <Typography variant="subtitle2">
                    Enable Dark Mode
                </Typography>
                <Typography variant="body2" color="textDisabled">
                    This feature is experimental!
                </Typography>
            </Grid>
            <Grid size={{ xs: 9 }}>
                <CheckboxElement name="experimentalDarkMode" size="small"
                                 readOnly={!!props.readOnly} />
            </Grid>

            <Grid size={{ xs: 12 }}><Divider /></Grid>

            <Grid size={{ xs: 3 }}>
                <Typography variant="subtitle2">
                    Enable Layout Refresh
                </Typography>
                <Typography variant="body2" color="textDisabled">
                    This feature is experimental!
                </Typography>
            </Grid>
            <Grid size={{ xs: 9 }}>
                <CheckboxElement name="experimentalLayout" size="small"
                                 readOnly={!!props.readOnly} />
            </Grid>

            <Grid size={{ xs: 12 }}><Divider /></Grid>

            <Grid size={{ xs: 3 }}>
                <Typography variant="subtitle2">
                    Enable Responsive Layout
                </Typography>
                <Typography variant="body2" color="textDisabled">
                    This feature is experimental!
                </Typography>
            </Grid>
            <Grid size={{ xs: 9 }}>
                <CheckboxElement name="experimentalResponsive" size="small"
                                 readOnly={!!props.readOnly} />
            </Grid>
        </>
    );
}
