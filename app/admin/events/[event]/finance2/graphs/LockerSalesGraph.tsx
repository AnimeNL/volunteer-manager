// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';

import type { FinanceProcessor } from '../FinanceProcessor';
import { DoublePieChart } from './DoublePieChart';

/**
 * Props accepted by the <LockerSalesGraph> component.
 */
interface LockerSalesGraphProps {
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
 * The <LockerSalesGraph> component displays a double layered pie chart displaying, in the inner
 * ring, the number of lockers sold for each of the days, and in the outer ring the number of
 * lockers that we expect to be in use during each of the days.
 */
export function LockerSalesGraph(props: LockerSalesGraphProps) {
    return (
        <Card elevation={1} sx={{
            aspectRatio: props.aspectRatio,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <DoublePieChart />
        </Card>
    );
}
