// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

import type { FinanceProcessor } from '../FinanceProcessor';
import { DoublePieChart } from './DoublePieChart';

/**
 * Props accepted by the <VisitorGraphCard> component.
 */
interface VisitorGraphCardProps {
    /**
     * Aspect ratio to apply to the graph's container, which defines its size.
     */
    aspectRatio?: number;

    /**
     * The financial processor that contains the relevant information.
     */
    processor: FinanceProcessor;
}

/**
 * The <VisitorGraphCard> component displays a double layered pie chart displaying, in the inner
 * ring, the sold tickets for each of the days, and in the outer ring the number of visitors that
 * we expect in each of the days.
 */
export function VisitorGraphCard(props: VisitorGraphCardProps) {
    return (
        <Card elevation={1} sx={{
            aspectRatio: props.aspectRatio,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <DoublePieChart series={props.processor.ticketSalesGraphView} />
            <Typography variant="body2" color="textSecondary" sx={{ pb: 1 }}>
                Ticket sales & visitors
            </Typography>
        </Card>
    );
}
