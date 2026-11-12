// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import DirectionsRunOutlinedIcon from '@mui/icons-material/DirectionsRunOutlined';

import type { DisplayHelpRequestTarget } from '@lib/database/Types';
import { Alert } from '../../components/Alert';
import { ScheduleContext } from '../../ScheduleContext';
import { TargetLoadingButton } from './TargetLoadingButton';

import { acknowledgeHelpRequest } from './HelpRequestActions';

/**
 * Props accepted by the <AcknowledgeForm> component.
 */
interface AcknowledgeFormProps {
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
 * The <AcknowledgeForm> component provides the ability to acknowledge a help request. A
 * confirmation dialog will be shown to make sure that the volunteer actually will head over.
 */
export function AcknowledgeForm(props: AcknowledgeFormProps) {
    const { refresh } = useContext(ScheduleContext);
    const router = useRouter();

    // ---------------------------------------------------------------------------------------------
    // Ability to confirm the acknowledgement
    // ---------------------------------------------------------------------------------------------

    const [ confirmationOpen, setConfirmationOpen ] = useState<boolean>(false);
    const [ error, setError ] = useState<string | undefined>();

    const closeConfirmation = useCallback(() => setConfirmationOpen(false), [ /* no deps */ ]);
    const openConfirmation = useCallback(() => {
        setConfirmationOpen(true);
        setError(undefined);
    }, [ /* no deps */ ]);

    // ---------------------------------------------------------------------------------------------
    // Ability to submit the acknowledgement
    // ---------------------------------------------------------------------------------------------

    const [ loading, setLoading ] = useState<boolean>(false);

    const handleAcknowledge = useCallback(async () => {
        setError(undefined);
        setLoading(true);
        try {
            const response = await acknowledgeHelpRequest({
                event: props.event,
                requestId: props.requestId,
            });

            if (!!response.success) {
                refresh?.();
                router.refresh();
            } else {
                setError(response.error ?? 'xThe request could not be acknowledged');
            }

        } catch (error: any) {
            setError(error.message || 'The request could not be acknowledged');
        } finally {
            setLoading(false);
        }
    }, [ props.event, props.requestId, refresh, router ]);

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <TargetLoadingButton fullWidth variant="contained" target={props.target}
                                 startIcon={ <DirectionsRunOutlinedIcon /> }
                                 onClick={openConfirmation} loading={!!confirmationOpen}>
                On my way!
            </TargetLoadingButton>
            <Dialog fullWidth open={confirmationOpen} onClose={closeConfirmation}>
                <DialogTitle>
                    Will you handle this request?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Only acknowledge requests that you're able to attend to <strong>
                        in the next five minutes</strong>, otherwise let someone else deal with it.
                    </DialogContentText>
                    <Collapse in={!!error}>
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    </Collapse>
                </DialogContent>
                <DialogActions sx={{ pr: 2, pb: 2 }}>
                    <Button color="inherit" onClick={closeConfirmation}>Cancel</Button>
                    <TargetLoadingButton variant="contained" onClick={handleAcknowledge}
                                         loading={!!loading} target={props.target}>
                        On my way!
                    </TargetLoadingButton>
                </DialogActions>
            </Dialog>
        </>
    );
}
