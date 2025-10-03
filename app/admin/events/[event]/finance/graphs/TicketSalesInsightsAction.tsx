// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InsightsIcon from '@mui/icons-material/Insights';
import Tooltip from '@mui/material/Tooltip';

import type { TicketSalesComparisonGraphProps } from './TicketSalesComparisonGraph';
import { LoadingGraph } from './LoadingGraph';
import { Markdown } from '@components/Markdown';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <TicketSalesInsightsAction> component.
 */
interface TicketSalesInsightsActionProps {
    /**
     * Events that are to be included in the generated insights.
     */
    events: TicketSalesComparisonGraphProps['events'];

    /**
     * Title of the graph, as should be displayed as the dialog's title.
     */
    title: string;
}

/**
 * The <TicketSalesInsightsAction> shows an action on the top-right corner of a ticket-related graph
 * for which we can provide AI-generated insights and projections.
 */
export function TicketSalesInsightsAction(props: TicketSalesInsightsActionProps) {
    const [ comparisonOpen, setComparisonOpen ] = useState<boolean>(false);

    const closeComparison = useCallback(() => setComparisonOpen(false), [ /* no deps */ ]);
    const openComparison = useCallback(() => setComparisonOpen(true), [ /* no deps */ ]);

    const [ error, setError ] = useState<string | undefined>();
    const [ insights, setInsights ] = useState<string | undefined>();

    useEffect(() => {
        if (!comparisonOpen)
            return;

        callApi('post', '/api/admin/event/finance/insights', { events: props.events })
            .then(response => {
                if (!!response.success)
                    setInsights(response.insights);
                else
                    setError(response.error ?? 'The insights could not be generated');
            })
            .catch(error => {
                setError(error.message);
            });

    }, [ comparisonOpen, props.events ]);

    return (
        <>
            <Tooltip title="Insights">
                <IconButton onClick={openComparison}>
                    <InsightsIcon color="info" fontSize="small" />
                </IconButton>
            </Tooltip>
            { !!comparisonOpen &&
                <Dialog open={comparisonOpen} onClose={closeComparison} fullWidth maxWidth="md">
                    <DialogTitle>{props.title} — Insights</DialogTitle>
                    <DialogContent>
                        <Collapse in={!!error}>
                            <Alert severity="error">
                                {error}
                            </Alert>
                        </Collapse>
                        <Collapse in={!insights}>
                            <LoadingGraph />
                        </Collapse>
                        <Collapse in={!!insights}>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                The following analysis was generated using AI. The content may
                                contain inaccuracies and should not be relied upon.
                            </Alert>
                            <Markdown>{insights}</Markdown>
                        </Collapse>
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
