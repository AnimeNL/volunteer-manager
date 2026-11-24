// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/**
 * Props accepted by the <StatisticsDetails> component.
 */
interface StatisticsDetailsProps {
    /**
     * Title of the graph, that will be prominently displayed.
     */
    title: string;

    /**
     * Description of this metric that will be shown in an informative alert dialog.
     */
    description: string;
}

/**
 * The <StatisticsDetails> component displays an alert box with more information about a particular
 * statistic, so that it can make sense even to those less familiar with KPIs.
 */
export function StatisticsDetails(props: StatisticsDetailsProps) {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleClose = useCallback(() => setOpen(false), [ /* no dependencies */ ]);
    const handleOpen = useCallback(() => setOpen(true), [ /* no dependencies */ ]);

    return (
        <>
            <IconButton onClick={handleOpen} size="small">
                <InfoOutlinedIcon color="info" fontSize="small" />
            </IconButton>
            <Dialog fullWidth open={open} onClose={handleClose}>
                <DialogTitle>
                    {props.title}
                </DialogTitle>
                <DialogContent sx={{ pb: 0 }}>
                    <DialogContentText>
                        {props.description}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button autoFocus onClick={handleClose}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
