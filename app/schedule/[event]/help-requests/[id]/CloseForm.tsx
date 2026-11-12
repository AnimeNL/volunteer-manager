// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type FieldValues, FormContainer, TextareaAutosizeElement } from '@proxy/react-hook-form-mui';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import DoneAllIcon from '@mui/icons-material/DoneAll';

import type { DisplayHelpRequestTarget } from '@lib/database/Types';
import { Alert } from '../../components/Alert';
import { ScheduleContext } from '../../ScheduleContext';
import { TargetLoadingButton } from './TargetLoadingButton';

import { closeHelpRequest } from './HelpRequestActions';

/**
 * Props accepted by the <CloseForm> component.
 */
interface CloseFormProps {
    /**
     * Unique slug of the event for which the request is in scope.
     */
    event: string;

    /**
     * Unique ID of the request that can be acknowledged.
     */
    requestId: number;

    /**
     * Target of the help request. Used to determine the button's colour.
     */
    target: DisplayHelpRequestTarget;
}

/**
 * The <CloseForm> component provides the ability to close out a help request. The reason must be
 * given, to make sure that the reason for the help request is properly recorded.
 */
export function CloseForm(props: CloseFormProps) {
    const { refresh } = useContext(ScheduleContext);
    const router = useRouter();

    // ---------------------------------------------------------------------------------------------
    // Ability to confirm the settlement
    // ---------------------------------------------------------------------------------------------

    const [ confirmationOpen, setConfirmationOpen ] = useState<boolean>(false);
    const [ error, setError ] = useState<string | undefined>();
    const [ reason, setReason ] = useState<string | undefined>();

    const closeConfirmation = useCallback(() => setConfirmationOpen(false), [ /* no deps */ ]);
    const openConfirmation = useCallback((data: FieldValues) => {
        if (!data.reason || !data.reason.length)
            return;  // form validation race condition?

        setConfirmationOpen(true);
        setError(undefined);
        setReason(data.reason);
    }, [ /* no deps */ ]);

    // ---------------------------------------------------------------------------------------------
    // Ability to submit the settlement
    // ---------------------------------------------------------------------------------------------

    const [ loading, setLoading ] = useState<boolean>(false);

    const handleSettlement = useCallback(async () => {
        setError(undefined);
        setLoading(true);
        try {
            if (!reason || !reason.length || reason.length < 5)
                throw new Error('The reason needs to be at least five characters long');

            const response = await closeHelpRequest({
                event: props.event,
                requestId: props.requestId,
                reason,
            });

            if (!!response.success) {
                refresh?.();
                router.refresh();
            } else {
                setError(response.error ?? 'The request could not be acknowledged');
            }

        } catch (error: any) {
            setError(error.message || 'The request could not be settled');
        } finally {
            setLoading(false);
        }
    }, [ props.event, props.requestId, reason, refresh, router ]);

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Card sx={{ p: 2 }}>
                <FormContainer onSuccess={openConfirmation}>
                    <TextareaAutosizeElement name="reason" label="What happened?" size="small"
                                             fullWidth required sx={{ mb: 2 }} />
                    <TargetLoadingButton variant="contained" type="submit" fullWidth
                                         loading={!!confirmationOpen} target={props.target}
                                         startIcon={ <DoneAllIcon /> }>
                        Close the request
                    </TargetLoadingButton>
                </FormContainer>
            </Card>
            <Dialog fullWidth open={!!confirmationOpen} onClose={closeConfirmation}>
                <DialogTitle>
                    Have you settled the request?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Only close requests that you have dealt with yourself, or have discussed
                        with the person who has. The reason will be recorded.
                    </DialogContentText>
                    <Collapse in={!!error}>
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    </Collapse>
                </DialogContent>
                <DialogActions sx={{ pr: 2, pb: 2 }}>
                    <Button color="inherit" onClick={closeConfirmation}>Cancel</Button>
                    <TargetLoadingButton variant="contained" onClick={handleSettlement}
                                         loading={!!loading} target={props.target}>
                        Close it!
                    </TargetLoadingButton>
                </DialogActions>
            </Dialog>
        </>
    );
}
