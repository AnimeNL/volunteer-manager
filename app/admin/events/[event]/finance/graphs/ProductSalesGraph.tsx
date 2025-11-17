// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { RemoteGraphFn } from './RemoteGraphFn';
import { type RemoteGraphProps, RemoteGraph } from './RemoteGraph';
import { fetchProductSales } from './ProductSalesGraphFn';

/**
 * Props accepted by the <ProductSalesGraph> component.
 */
interface ProductSalesGraphProps extends Omit<RemoteGraphProps, 'fetchDataFn'> {
    /**
     * Unique ID of the event for which the graph should be displayed.
     */
    eventId: number;

    /**
     * Unique IDs of the products that should be included in this sales graph.
     */
    products: number[];
}

/**
 * The <ProductSalesGraph> graph displays a line graph, containing one line per product, visualising
 * sales of a product group over the course of convention organisation.
 */
export function ProductSalesGraph(props: ProductSalesGraphProps) {
    const { eventId, products, ...rest } = props;

    const fetchDataFn = fetchProductSales.bind(null, eventId, products) as RemoteGraphFn;
    return <RemoteGraph fetchDataFn={fetchDataFn} {...rest} />;
}
