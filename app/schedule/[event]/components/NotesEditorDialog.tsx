// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';

import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';

import { Alert } from '../components/Alert';

/**
 * Props accepted by the <NotesEditorDialog> component.
 */
interface NotesEditorDialogProps {
    /**
     * To be called when the notes dialog has been closed.
     */
    onClose?: () => void;

    /**
     * To be called when the updates notes are to be submitted. When the return value is truthy,
     * the dialog will be closed, whereas an error will be shown in case of a failure.
     */
    onSubmit?: (notes: string) => Promise<boolean>;

    /**
     * The notes that are stored for the context at the moment.
     */
    notes?: string;

    /**
     * Whether the dialog should be presented to the user.
     */
    open?: boolean;
}

/**
 * The <NotesEditorDialog> component displays a dialog, when opened, in which the notes for a given
 * event or volunteer can be changed. Markdown is supported in updated notes.
 */
export default function NotesEditorDialog(props: NotesEditorDialogProps) {
    const { onClose, onSubmit, open } = props;

    const [ error, setError ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const [ notes, setNotes ] = useState<string>(props.notes || '');

    useEffect(() => setNotes(props.notes || ''), [ props.notes ]);

    const handleClose = useCallback(() => {
        setTimeout(() => {
            setError(false);
            setNotes(props.notes || '');
        }, 350);

        if (!!onClose)
            onClose();

    }, [ onClose, props.notes, setNotes ]);

    const handleUpdateNotes = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(event.target.value);

    }, [ /* no deps */ ]);

    const handleSubmit = useCallback(async () => {
        setError(false);
        setLoading(true);
        try {
            if (!!await onSubmit?.(notes))
                handleClose();
            else
                setError(true);
        } catch (error: any) {
            console.warn('Unable to submit the notes:', error);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [ handleClose, notes, onSubmit ]);

    return (
        <Dialog onClose={handleClose} open={!!open} fullWidth>
            <DialogTitle sx={{ mb: -1 }}>
                What should we keep in mind?
            </DialogTitle>
            <DialogContent sx={{ pt: '8px !important' }}>
                <TextField fullWidth multiline label="Notes" size="small"
                           value={notes} onChange={handleUpdateNotes} />
                <Collapse in={!!error}>
                    <Alert severity="error" sx={{ mt: 2 }}>
                        The notes could not be saved. Try again later?
                    </Alert>
                </Collapse>
            </DialogContent>
            <DialogActions sx={{ pr: 3, pb: 2, mt: -1 }}>
                <Button color="inherit" onClick={handleClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} loading={!!loading}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
