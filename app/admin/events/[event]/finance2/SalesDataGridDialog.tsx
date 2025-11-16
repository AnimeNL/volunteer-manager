// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

import { ProductSalesGraph } from './graphs/ProductSalesGraph';

/**
 * Props accepted by the <SalesDataGridDialog> component.
 */
interface SalesDataGridDialogProps {
    /**
     * Unique ID of the event for which the graph should be displayed.
     */
    eventId: number;

    /**
     * Callback to invoke when the dialog should be closed.
     */
    onClose?: () => void;

    /**
     * One of more product IDs that should be displayed in the graph.
     */
    products: number[];

    /**
     * Title of the dialog, to show in the user interface.
     */
    title: string;
}

/**
 * The <SalesDataGridDialog> component displays a dialog with more information about the sales of
 * one or more products, including a graph that will be dynamically generated through an API.
 */
export function SalesDataGridDialog(props: SalesDataGridDialogProps) {

    return (
        <Dialog open onClose={props.onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                {props.title}
            </DialogTitle>
            <DialogContent>
                <ProductSalesGraph eventId={props.eventId} products={props.products} />
            </DialogContent>
            <DialogActions sx={{ pt: 0, mr: 1, mb: 0, pl: 2 }}>
                <Button onClick={props.onClose} variant="text">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
