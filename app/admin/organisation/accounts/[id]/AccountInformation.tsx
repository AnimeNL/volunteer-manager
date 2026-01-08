// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import type { ServerAction } from '@lib/serverAction';
import { ConfirmationDialog } from '@app/admin/components/ConfirmationDialog';
import { DiscordIcon } from './DiscordIcon';
import { LocalDatePickerElement } from '@components/LocalDatePickerElement';

import { kGenderOptions } from '@app/registration/authentication/RegisterForm';

/**
 * Props accepted by the <AccountInformation> component.
 */
interface AccountInformationProps {
    /**
     * Server action that can be invoked to confirm this account's Discord handle.
     */
    confirmDiscordFn: ServerAction;

    /**
     * The user's Discord handle, when known.
     */
    discordHandle?: string;

    /**
     * Whether the user's Discord handle was updated since the last check.
     */
    discordHandleUpdated?: boolean;

    /**
     * Whether the form should be displayed in read-only mode, i.e. submission should be disabled.
     */
    readOnly?: boolean;

    /**
     * Unique ID of the user for whom the information is being shown.
     */
    userId: number;
}

/**
 * The <AccountInformation> component lists the volunteer's basic information, which may be amended
 * by the person who has access to this page. Amendments are made using an API call.
 */
export function AccountInformation(props: AccountInformationProps) {
    const router = useRouter();

    const [ discordConfirmationOpen, setDiscordConfirmationOpen ] = useState<boolean>(false);

    const handleCloseDiscord = useCallback(() => setDiscordConfirmationOpen(false), []);
    const handleConfirmDiscord = useCallback(async () => {
        const response = await props.confirmDiscordFn(new FormData);
        if (!response.success)
            return { error: response.error || 'The verification could not be processed…' };

        router.refresh();
        return true;

    }, [ props, router ]);

    const handleVerifyDiscord = useCallback(() => {
        setDiscordConfirmationOpen(true);
    }, [ /* no dependencies */ ]);

    return (
        <>
            <Grid size={{ xs: 6, md: 3 }}>
                <TextFieldElement name="firstName" label="First name" type="text"
                                  fullWidth size="small" required
                                  slotProps={{ input: { readOnly: !!props.readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
                <TextFieldElement name="lastName" label="Last name" type="text"
                                  fullWidth size="small" required
                                  slotProps={{ input: { readOnly: !!props.readOnly } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="displayName" label="Display name" type="text"
                                  fullWidth size="small"
                                  slotProps={{ input: { readOnly: !!props.readOnly } }} />
            </Grid>

            <Grid size={{ xs: 6 }}>
                <LocalDatePickerElement name="birthdate" label="Date of birth"
                                        disableFuture disableHighlightToday openTo="year"
                                        inputProps={{ fullWidth: true, size: 'small' }}
                                        readOnly={!!props.readOnly} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="gender" label="Gender" options={kGenderOptions}
                               fullWidth size="small" required
                               slotProps={{ select: { readOnly: !!props.readOnly } }} />
            </Grid>

            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="username" label="E-mail address" type="email"
                                  fullWidth size="small"
                                  slotProps={{ input: { readOnly: !!props.readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="phoneNumber" label="Phone number" type="tel"
                                  fullWidth size="small"
                                  slotProps={{ input: { readOnly: !!props.readOnly } }} />
            </Grid>

            <Grid size={{ xs: 6 }}>
                <Stack direction="row" spacing={1}>
                    <TextFieldElement name="discordHandle" label="Discord handle"
                                      fullWidth size="small"
                                      slotProps={{ input: { readOnly: !!props.readOnly } }} />

                    { !!props.discordHandleUpdated &&
                        <Tooltip title="Mark their handle as verified">
                            <IconButton onClick={handleVerifyDiscord} disabled={!!props.readOnly}>
                                <DiscordIcon htmlColor="#5865F2" />
                            </IconButton>
                        </Tooltip> }
                    { !props.discordHandleUpdated &&
                        <Tooltip title="Their handle has been verified">
                            <Box sx={{ p: 1, pb: 0 }}>
                                <DiscordIcon color="disabled" />
                            </Box>
                        </Tooltip> }
                </Stack>
            </Grid>
            <Grid size={{ xs: 6 }}>
                { /* available */ }
            </Grid>

            { !!props.discordHandle &&
                <ConfirmationDialog open={!!discordConfirmationOpen} onClose={handleCloseDiscord}
                                    onConfirm={handleConfirmDiscord}
                                    title="Verify their Discord handle">
                    By confirming this dialog, you verify that their Discord handle
                    (<strong>{props.discordHandle}</strong>) has been granted the "Crew" role on our
                    server. Ideally you'd have send them a nice message too.
                </ConfirmationDialog> }

        </>
    );
}
