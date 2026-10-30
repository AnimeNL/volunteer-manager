// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import SummarizeIcon from '@mui/icons-material/Summarize';
import Tooltip from '@mui/material/Tooltip';

import type { ServerActionResult } from '@lib/serverAction';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

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
    const [ summary, setSummary ] = useState<React.ReactNode | undefined>(undefined);

    useEffect(() => {
        if (!dialogOpen)
            return;  // only consider generating a summary when the dialog's being opened

        if (!!error || summary !== undefined)
            return;  // a summary has already been (tried to be) generated

        props.generateSummaryFn().then(result => {
            if (!result.success) {
                setError(result.error ?? 'A server error occurred while generating a summary.');
            } else {
                setSummary(result.markdown);
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
                <ResponsiveDialog open onClose={ () => setDialogOpen(false) }
                                  title="Duty Book summary">
                    <Collapse in={!!error} unmountOnExit>
                        <Alert severity="error">{error}</Alert>
                    </Collapse>
                    { summary !== undefined && summary }
                    { summary === undefined &&
                        <>
                            <Skeleton variant="text" animation="wave" width="85%" height={8} />
                            <Skeleton variant="text" animation="wave" width="65%" height={8} />
                            <Skeleton variant="text" animation="wave" width="80%" height={8} />
                            <Skeleton variant="text" animation="wave" width="75%" height={8} />
                            <Skeleton variant="text" animation="wave" width="55%" height={8} />
                        </> }
                </ResponsiveDialog> }
        </>
    );
}
