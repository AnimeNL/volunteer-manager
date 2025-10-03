// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';

import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';

import { Alert } from '../components/Alert';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <FeedbackDialog> component.
 */
interface FeedbackDialogProps {
    /**
     * To be called when the notes dialog has been closed.
     */
    onClose?: () => void;

    /**
     * Whether the dialog should be presented to the user.
     */
    open?: boolean;
}

/**
 * The <FeedbackDialog> component displays a dialog, when opened, in which a volunteer is able to
 * submit feedback about the Volunteer Portal. All feedback will be recorded in the database.
 */
export default function FeedbackDialog(props: FeedbackDialogProps) {
    const { onClose, open } = props;

    const [ error, setError ] = useState<string | false>(false);
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ success, setSuccess ] = useState<boolean>(false);

    const [ feedback, setFeedback ] = useState<string>('');
    useEffect(() => setFeedback(''), [ /* no deps */ ]);

    const handleClose = useCallback(() => {
        setTimeout(() => {
            setError(false);
            setFeedback('');
            setSuccess(false);
        }, 350);

        if (!!onClose)
            onClose();

    }, [ onClose ]);

    const handleUpdateFeedback = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
        setFeedback(event.target.value);
    }, [ /* no deps */ ]);

    const handleSubmit = useCallback(async () => {
        setError(false);
        setLoading(true);
        try {
            if (feedback.length < 8)
                throw new Error('Your feedback is too short, could you add some more context?');

            const response = await callApi('post', '/api/event/schedule/feedback', { feedback });
            if (!!response.success)
                setSuccess(true);
            else
                setError(response.error || 'The feedback could not be saved. Try again later?');

        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ feedback ]);

    return (
        <Dialog onClose={handleClose} open={!!open} fullWidth>
            <DialogTitle sx={{ mb: -1 }}>
                What should we get better at?
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    We'd love to hear your feedback regarding AnimeCon, your volunteering duties,
                    the portal, schedules, or anything else.
                </DialogContentText>
                <TextField fullWidth multiline label="Feedback" size="small"
                           value={feedback} onChange={handleUpdateFeedback} />
                <Collapse in={!!error}>
                    <Alert severity="error" sx={{ mt: 2 }}>
                        { error || 'The feedback could not be saved. Try again later?' }
                    </Alert>
                </Collapse>
                <Collapse in={!!success}>
                    <Alert severity="success" sx={{ mt: 2 }}>
                        Thank you! Your feedback has been recorded.
                    </Alert>
                </Collapse>
            </DialogContent>
            <DialogActions sx={{ pr: 3, pb: 2, mt: -1 }}>
                <Button color="inherit" onClick={handleClose}>
                    { success ? 'Close' : 'Cancel' }
                </Button>
                { !success &&
                    <Button variant="contained" onClick={handleSubmit} loading={!!loading}>
                        Save
                    </Button> }
            </DialogActions>
        </Dialog>
    );
}
