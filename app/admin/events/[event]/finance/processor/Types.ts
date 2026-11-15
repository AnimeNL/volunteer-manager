// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketCategory } from '@lib/database/Types';

/**
 * Aggregated sales count for a single product on a single UTC calendar date (`YYYY-MM-DD`).
 */
export interface ProviderSale {
    /**
     * UTC calendar date (`YYYY-MM-DD`) on which the sales were recorded.
     */
    date: string;

    /**
     * Whether these sales were issued free of charge (complimentary / guest list).
     */
    complimentary: boolean;

    /**
     * Number of items sold on `date` matching `complimentary`.
     */
    count: number;
}

/**
 * Provider-neutral representation of a configured product and its daily sales for graphing.
 */
export interface ProviderProductSales {
    /**
     * Unique ID of the configured ticket entry (`events_tickets_configuration.event_ticket_id`).
     */
    id: number;

    /**
     * Maximum number of items that can be sold for this product, when capped.
     */
    limit?: number;

    /**
     * Human-readable name of the product as imported from the ticketing provider.
     */
    product: string;

    /**
     * Daily sales recorded for this product across valid orders.
     */
    sales: ProviderSale[];
}

/**
 * Provider-neutral representation of a categorised event product and its raw daily sales.
 */
export interface ProviderProduct extends ProviderProductSales {
    /**
     * Category of sale that this product belongs to.
     */
    category: EventTicketCategory;

    /**
     * Unit price, in local currency, for which this product is sold.
     */
    price?: number;

    /**
     * Optional AnPlan program association configured for this product.
     */
    program: {
        id?: number;
        title?: string;
    };
}
