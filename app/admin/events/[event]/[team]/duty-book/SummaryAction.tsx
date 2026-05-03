// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import SummarizeIcon from '@mui/icons-material/Summarize';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';

import type { ServerActionResult } from '@lib/serverAction';
import { Markdown } from '@app/components/Markdown';

/**
 * Props accepted by the <SummaryAction> component.
 */
interface SummaryActionProps {
    /**
     * Server Action through which a summary can be requested.
     */
    generateSummaryFn: () => Promise<ServerActionResult>;
}

/**
 * The <SummaryAction> component provides the ability to automatically generate a summary of the
 * Duty Book of a particular event using AI. An endpoint is used which proxies the actual calls to
 * the model, where an additional prompt will be added for context as well.
 */
export function SummaryAction(props: SummaryActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const [ error, setError ] = useState<string | undefined>(undefined);
    const [ summary, setSummary ] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!dialogOpen)
            return;  // only consider generating a summary when the dialog's being opened

        if (!!error || !!summary)
            return;  // a summary has already been (tried to be) generated

        props.generateSummaryFn().then(result => {
            if (!result.success) {
                setError(result.error ?? 'A server error occurred while generating a summary.');
            } else {
                setSummary(result.summary);
            }
        }, error => {
            setError(error?.message ?? 'A client error occurred while generating a summary.');
        });

    }, [ dialogOpen, error, props.generateSummaryFn, summary ]);

    return (
        <>
            <Tooltip title="Generate a summary…">
                <IconButton size="small" onClick={ () => setDialogOpen(true) }>
                    <SummarizeIcon color="primary" fontSize="small" />
                </IconButton>
            </Tooltip>
            { !!dialogOpen &&
                <Dialog fullWidth maxWidth="md" onClose={ () => setDialogOpen(false) } open
                        scroll="paper">
                    <DialogContent>
                        <Collapse in={!!error}>
                            <Alert severity="error">{error}</Alert>
                        </Collapse>
                        { !!summary &&
                            <Markdown sx={{
                                '& h5:first-child': { pb: 0.5, fontSize: 24 }
                            }}>{summary}</Markdown> }
                        { !summary &&
                            <>
                                <Skeleton variant="text" animation="wave" width="80%" height={16} />
                                <Skeleton variant="text" animation="wave" width="60%" height={16} />
                                <Skeleton variant="text" animation="wave" width="70%" height={16} />
                                <Skeleton variant="text" animation="wave" width="70%" height={16} />
                                <Skeleton variant="text" animation="wave" width="40%" height={16} />
                            </> }
                    </DialogContent>
                    <Divider />
                    <DialogActions sx={{ pt: 1, mr: 1, mb: 0 }}>
                        <Button onClick={ () => setDialogOpen(false) } variant="text">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog> }
        </>
    );
}
