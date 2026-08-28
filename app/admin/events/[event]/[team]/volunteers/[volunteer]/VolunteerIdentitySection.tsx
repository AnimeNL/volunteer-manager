// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useState } from 'react';

import { TextFieldElement } from '@components/proxy/react-hook-form-mui';

import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import PhoneIcon from '@mui/icons-material/Phone';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { Avatar } from '@components/Avatar';
import { FormGrid } from '@app/admin/components/FormGrid';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';

/**
 * Props accepted by the <VolunteerIdentitySection> component.
 */
interface VolunteerIdentitySectionProps {
    /**
     * Server Action through which their notes can be updated.
     */
    action: ServerAction;

    /**
     * Details of the volunteer to display in the identity section.
     */
    details: {
        /**
         * URL to the user's account information, when accessible.
         */
        accountLink?: string;

        /**
         * URL to the user's avatar, when known.
         */
        avatar?: string;

        /**
         * Whether the volunteer has cancelled their participation.
         */
        cancelled?: boolean;

        /**
         * E-mail address of the volunteer, when known.
         */
        email?: string;

        /**
         * Either the volunteer's full name or display name.
         */
        name: string;

        /**
         * Phone number of the volunteer, when known.
         */
        phoneNumber?: string;

        /**
         * Role that the volunteer will fulfil in this event.
         */
        role: string;
    },

    /**
     * Existing notes for this volunteer.
     */
    notes?: string;
}

/**
 * Element that displays basic information about the volunteer, links through to their account page
 * when known, and selectively shares their contact information.
 */
export function VolunteerIdentitySection(props: VolunteerIdentitySectionProps) {
    const [ emailDialogOpen, setEmailDialogOpen ] = useState<boolean>(false);
    const [ phoneDialogOpen, setPhoneDialogOpen ] = useState<boolean>(false);

    return (
        <Paper sx={{ px: 2, py: 2 }}>
            <Stack direction="column" spacing={2}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Avatar src={props.details.avatar}>{props.details.name}</Avatar>
                    <Divider flexItem orientation="vertical" />
                    <Stack direction="column" sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">
                            {props.details.name}
                        </Typography>
                        { !props.details.cancelled &&
                            <Typography color="textDisabled" variant="body2">
                                {props.details.role}
                            </Typography> }
                        { !!props.details.cancelled &&
                            <Chip color="error" label="Cancelled" size="small"
                                  sx={{ alignSelf: 'flex-start' }} /> }
                    </Stack>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        { !!props.details.accountLink &&
                            <IconButton LinkComponent={Link} href={props.details.accountLink}
                                        size="small">
                                <Tooltip title="Account details">
                                    <TooltipIconWrapper>
                                        <AccountCircleOutlinedIcon color="primary"
                                                                   fontSize="medium" />
                                    </TooltipIconWrapper>
                                </Tooltip>
                            </IconButton> }
                        { !!props.details.email &&
                            <IconButton size="small" onClick={ () => setEmailDialogOpen(true) }>
                                <Tooltip title="See their e-mail address…">
                                    <TooltipIconWrapper>
                                        <AlternateEmailIcon color="primary" fontSize="medium" />
                                    </TooltipIconWrapper>
                                </Tooltip>
                            </IconButton> }
                        { !!props.details.phoneNumber &&
                            <IconButton size="small" onClick={ () => setPhoneDialogOpen(true) }>
                                <Tooltip title="See their phone number…">
                                    <TooltipIconWrapper>
                                        <PhoneIcon color="primary" fontSize="medium" />
                                    </TooltipIconWrapper>
                                </Tooltip>
                            </IconButton> }
                    </Stack>

                    { !!props.details.email &&
                        <ResponsiveDialog
                            open={emailDialogOpen}
                            onClose={ () => setEmailDialogOpen(false) }
                            title="Their e-mail address"
                            description={
                                `This is ${props.details.name}'s email address. You must use ` +
                                'this address only for tasks related to this event. Always ' +
                                'follow our privacy policy.'
                            }>

                            <TextField name="value" label="E-mail address" size="small" fullWidth
                                       value={props.details.email} />

                        </ResponsiveDialog> }

                    { !!props.details.phoneNumber &&
                        <ResponsiveDialog
                            open={phoneDialogOpen}
                            onClose={ () => setPhoneDialogOpen(false) }
                            title="Their phone number"
                            description={
                                `This is ${props.details.name}'s phone number. You must use this ` +
                                'number only for tasks related to this event. Always follow our ' +
                                'privacy policy.'
                            }>

                            <TextField name="value" label="Phone number" size="small" fullWidth
                                       value={props.details.phoneNumber} />

                        </ResponsiveDialog> }

                </Stack>
                <FormGrid action={props.action} defaultValues={{ notes: props.notes }}>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="notes" label="Internal notes" fullWidth size="small"
                                          multiline />
                    </Grid>
                </FormGrid>
            </Stack>
        </Paper>
    );
}
