// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState, type ChangeEvent } from 'react';

import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { Alert } from '../components/Alert';

/**
 * Minimum number of characters that comprise an incident.
 */
const kMinimumIncidentLength = 8;

/**
 * Props accepted by the <ReportIncidentDialog> component.
 */
interface ReportIncidentDialogProps {
    /**
     * To be called when the incident dialog has been closed.
     */
    onClose?: () => void;

    /**
     * To be called when the incident is ready to be submitted.
     */
    onSubmit?: (incident: string) => Promise<boolean>;
}

/**
 * The <ReportIncidentDialog> component displays a dialog that allows the user to report an incident
 * to the other volunteers.
 */
export function ReportIncidentDialog(props: ReportIncidentDialogProps) {
    const { onClose, onSubmit } = props;

    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

    const [ error, setError ] = useState<false | string>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const [ incident, setIncident ] = useState<string>('');

    const handleClose = useCallback(() => {
        setTimeout(() => {
            setError(false);
            setIncident('');
        }, 350);

        if (!!onClose)
            onClose();

    }, [ onClose ]);

    const handleUpdateIncident = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
        setIncident(event.target.value);

    }, [ /* no deps */ ]);

    const handleSubmit = useCallback(async () => {
        setError(false);
        setLoading(true);
        try {
            if (incident.length < kMinimumIncidentLength)
                throw new Error(`Reports must have at least ${kMinimumIncidentLength} characters.`);

            if (!!await onSubmit?.(incident))
                handleClose();
            else
                setError('The incident could not be saved. Try again later?');
        } catch (error: any) {
            console.warn('Unable to submit the incident:', error);
            setError(error.message || 'The incident could not be saved.');
        } finally {
            setLoading(false);
        }
    }, [ handleClose, incident, onSubmit ]);

    return (
        <Dialog onClose={handleClose} open={!!open} fullWidth fullScreen={fullScreen}>
            <DialogTitle sx={{ mb: -1 }}>
                Please describe what happened
            </DialogTitle>
            <DialogContent sx={{ pt: '8px !important' }}>
                <TextField fullWidth multiline label="Incident…" size="small"
                           value={incident} onChange={handleUpdateIncident} />
                <Collapse in={!!error}>
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                </Collapse>
            </DialogContent>
            <DialogActions sx={{ pr: 3, pb: 2, mt: -1 }}>
                <Button color="inherit" onClick={handleClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} loading={!!loading}>
                    Report
                </Button>
            </DialogActions>
        </Dialog>
    );
}
