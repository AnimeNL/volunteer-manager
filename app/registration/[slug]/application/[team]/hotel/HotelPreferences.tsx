// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useState } from 'react';

import { useFormContext } from '@components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import HotelIcon from '@mui/icons-material/Hotel';
import Typography from '@mui/material/Typography';

import { CollapsableGrid } from '@components/CollapsableGrid';
import { FormProviderContext } from '@components/FormProvider';
import { HotelForm, type HotelFormProps }
    from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/HotelForm';

/**
 * The <HotelPreferences> component provides the interactivity for a form through which volunteers
 * are able to submit their preferences in regards to staying in a hotel room organised through us,
 * which requires them to acknowledge that they are making a financial commitment.
 */
export function HotelPreferences(props: HotelFormProps) {
    const [ confirmationOpen, setConfirmationOpen ] = useState<boolean>(false);
    const [ formElement, setFormElement ] = useState<HTMLFormElement | null>(null);

    const form = useFormContext();

    const formContext = useContext(FormProviderContext);
    const formError = !!formContext.result && !formContext.result.success;

    const requestConfirmationClose = useCallback(() => setConfirmationOpen(false), []);
    const requestConfirmation = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
        const parentForm = event.currentTarget.form;
        if (!parentForm)
            return;

        const values = form.getValues();
        if (!!values.interested) {
            if (!await form.trigger())
                return;

            setConfirmationOpen(true);
            setFormElement(parentForm);
        } else {
            parentForm.requestSubmit();
        }
    }, [ form ]);

    const requestSubmit = useCallback(() => {
        if (!!formElement)
            formElement.requestSubmit();

        setConfirmationOpen(false);

    }, [ formElement ]);

    return (
        <>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="h5">
                        Your hotel room preferences
                    </Typography>
                </Grid>

                { !!props.readOnly &&
                    <Grid size={{ xs: 12 }}>
                        <Alert severity="warning" sx={{ mt: -1 }}>
                            Your booking is all set, and your preferences are now locked. If you
                            have any questions, feel free to send us an e-mail!
                        </Alert>
                    </Grid>}

                <HotelForm {...props} />

                <CollapsableGrid size={{ xs: 12 }} in={!!formError}>
                    <Alert severity="error">
                        { formContext.result?.error || 'The changes could not be saved' }
                    </Alert>
                </CollapsableGrid>

                { !props.readOnly &&
                    <Grid size={{ xs: 12 }}>
                        <Button variant="contained" loading={!!formContext.isPending}
                                startIcon={ <HotelIcon /> } onClick={requestConfirmation}>
                            Save your preferences
                        </Button>
                    </Grid> }
            </Grid>

            <Dialog open={confirmationOpen} onClose={ () => setConfirmationOpen(false) } fullWidth>
                <DialogTitle>
                    You're booking a hotel room
                </DialogTitle>
                <DialogContent>
                    Your hotel room will be confirmed in the months leading to the event. If you
                    need to cancel your reservation within 6 weeks of the event, you will either
                    need to pay the full amount or find someone else to stay in the room.
                </DialogContent>
                <DialogActions sx={{ pr: 2, pb: 2 }}>
                    <Button onClick={requestConfirmationClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={requestSubmit}>
                        Proceed
                    </Button>
                </DialogActions>
            </Dialog>

        </>
    );
}
