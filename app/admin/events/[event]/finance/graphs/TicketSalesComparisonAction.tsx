// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import HistoryIcon from '@mui/icons-material/History';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

/**
 * Props accepted by the <TicketSalesComparisonActionProps> component.
 */
interface TicketSalesComparisonActionProps {
    /**
     * The graph node that should be displayed once activated.
     */
    graph: React.ReactNode;

    /**
     * Title of the graph, as should be displayed as the dialog's title.
     */
    title: string;
}

/**
 * The <TicketSalesComparisonAction> shows an action on the top-right corner of a regular graph that
 * allows a multi-year comparison to open in a dialog.
 */
export function TicketSalesComparisonAction(props: TicketSalesComparisonActionProps) {
    const { graph, title } = props;

    const [ comparisonOpen, setComparisonOpen ] = useState<boolean>(false);

    const closeComparison = useCallback(() => setComparisonOpen(false), [ /* no deps */ ]);
    const openComparison = useCallback(() => setComparisonOpen(true), [ /* no deps */ ]);

    return (
        <>
            <Tooltip title="Y/Y Cumulative Sales">
                <IconButton onClick={openComparison}>
                    <HistoryIcon color="info" fontSize="small" />
                </IconButton>
            </Tooltip>
            { !!comparisonOpen &&
                <Dialog open={comparisonOpen} onClose={closeComparison} fullWidth maxWidth="md">
                    <DialogTitle>
                        {title} — Y/Y Cumulative Sales
                    </DialogTitle>
                    <DialogContent>
                        {graph}
                    </DialogContent>
                    <DialogActions sx={{ pt: 1, mr: 1, mb: 0 }}>
                        <Button onClick={closeComparison} variant="text">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog> }
        </>
    );
}
