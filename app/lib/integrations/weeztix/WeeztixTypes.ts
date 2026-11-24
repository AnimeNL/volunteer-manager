// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Request payload for the DELETE /order/:guid/custom_refund API.
 * @see https://docs.weeztix.com/api/dashboard/order-custom-refund
 */
export const kDeleteOrderCustomRefundRequest = z.object({
    refund: z.boolean().optional(),
    comment: z.string().nonempty().max(255),
    includes_fees: z.boolean(),
    entire_order: z.boolean(),
    items: z.array(z.object({
        guid: z.string().nonempty(),
        type: z.enum([ 'payment', 'ticket', 'product' ]),
    })),
    arbitrary: z.object({
        amount: z.number().int(),
        vat: z.number().int(),
    }).optional(),
});

/**
 * Request payload for the DELETE /order/:guid/custom_refund API.
 */
export type DeleteOrderCustomRefundRequest = z.infer<typeof kDeleteOrderCustomRefundRequest>;

/**
 * Recursive fatal, error, or notice entry returned by the custom refund API.
 */
interface OrderRefundMessage {
    subjectType?: string;
    guid?: string;
    reservation?: string | null;
    reason?: string | null;
    extra?: Record<string, unknown> | null;
    parentOf?: OrderRefundMessage | null;
}

const kOrderRefundMessageSchema: z.ZodType<OrderRefundMessage> = z.object({
    subjectType: z.string().optional(),
    guid: z.string().optional(),
    reservation: z.string().nullish(),
    reason: z.string().nullish(),
    extra: z.record(z.string(), z.unknown()).nullish(),
    parentOf: z.lazy(() => kOrderRefundMessageSchema).nullish(),
});

const kOrderRefundMessagesSchema =
    z.union([ kOrderRefundMessageSchema, z.array(kOrderRefundMessageSchema) ]).nullish();

/**
 * Expected response for the DELETE /order/:guid/custom_refund API.
 * @see https://docs.weeztix.com/api/dashboard/order-custom-refund
 */
export const kDeleteOrderCustomRefundResponse = z.object({
    fatals: kOrderRefundMessagesSchema,
    errors: kOrderRefundMessagesSchema,
    notices: kOrderRefundMessagesSchema,
    redirectUrl: z.string().nullish(),
    amount: z.number().nullish(),
    order_id: z.string().nullish(),
});

/**
 * Expected response for the DELETE /order/:guid/custom_refund API.
 */
export type DeleteOrderCustomRefundResponse = z.infer<typeof kDeleteOrderCustomRefundResponse>;

/**
 * Expected response for the /event/:guid API.
 * @see https://docs.weeztix.com/api/dashboard/get-event-specific
 */
export const kGetEventResponse = z.object({
    guid: z.string().nonempty(),
    company_id: z.string().nonempty(),
    name: z.string().nonempty(),
});

/**
 * Expected response for the /event/:guid API.
 */
export type GetEventResponse = z.infer<typeof kGetEventResponse>;

/**
 * Expected response for the /event/{type?} API.
 * @see https://docs.weeztix.com/api/dashboard/get-events
 */
export const kGetEventsResponse = z.array(z.object({
    guid: z.string().nonempty(),
    company_id: z.string().nonempty(),
    name: z.string().nonempty(),
    location: z.object({
        guid: z.string().nonempty(),
        name: z.string().nonempty(),
    }),
}));

/**
 * Expected response for the /event/{type?} API.
 */
export type GetEventsResponse = z.infer<typeof kGetEventsResponse>;

/**
 * Expected response for the /metaData/{type?} API.
 * @see https://docs.weeztix.com/api/dashboard/get-metadata
 */
export const kGetMetadataResponse = z.array(z.object({
    guid: z.string().nonempty(),
    name: z.string().min(1).max(255),
}));

/**
 * Expected response for the /metaData/{type?} API.
 */
export type GetMetadataResponse = z.infer<typeof kGetMetadataResponse>;

/**
 * Schema associated with an OrderMetadata entry attached to an order, ticket, or product.
 */
const kOrderMetadataSchema = z.object({
    guid: z.string().nonempty(),
    metadata_id: z.string().nonempty(),
    value: z.union([ z.string(), z.number(), z.boolean() ]).nullish(),
});

/**
 * Schema associated with a product entry returned by the /order/:guid API.
 */
const kGetOrderProductSchema = z.object({
    guid: z.string().nonempty(),
    finn_service_fee: z.number().optional(),
    finn_price: z.number().optional(),
    invalidated_since: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
    product: z.object({ guid: z.string().nonempty() }).optional(),
    meta_data: z.array(kOrderMetadataSchema).optional(),
});

/**
 * Schema associated with a ticket entry returned by the /order/:guid API.
 */
const kGetOrderTicketSchema = z.object({
    guid: z.string().nonempty(),
    finn_service_fee: z.number().optional(),
    finn_price: z.number().optional(),
    ticket_number: z.string().nullish(),
    invalidated_since: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
    ticket: z.object({ guid: z.string().nonempty() }).optional(),
    metadata: z.array(kOrderMetadataSchema).optional(),
    meta_data: z.array(kOrderMetadataSchema).optional(),
    products: z.array(kGetOrderProductSchema).optional(),
});

/**
 * Expected response for the /order/:guid API.
 * @see https://docs.weeztix.com/api/dashboard/get-order-specific
 */
export const kGetOrderResponse = z.object({
    guid: z.string().nonempty(),
    email: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    fullname: z.string().nullish(),
    locale: z.string().nullish(),
    status: z.string().nullish(),
    invalidated_since: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
    products: z.array(kGetOrderProductSchema).optional(),
    tickets: z.array(kGetOrderTicketSchema).optional(),
});

/**
 * Expected response for the /order/:guid API.
 */
export type GetOrderResponse = z.infer<typeof kGetOrderResponse>;

/**
 * Expected response for the /scanner/{type?} API.
 * @see https://docs.weeztix.com/api/dashboard/get-scanners
 */
export const kGetScannerTypesResponse = z.array(z.object({
    guid: z.string().nonempty(),
    name: z.string().nonempty(),
    event_id: z.string().nonempty(),
}));

/**
 * Expected response for the /scanner/{type?} API.
 * @see https://docs.weeztix.com/api/dashboard/get-scanners
 */
export type GetScannerTypesResponse = z.infer<typeof kGetScannerTypesResponse>;

/**
 * Expected response for the /shop/:guid/tickets API.
 * @see https://docs.weeztix.com/api/dashboard/get-shop-specific-ticket
 */
export const kGetShopTicketTypesResponse = z.array(z.object({
    guid: z.string().nonempty(),
    event_id: z.string().nonempty(),
    name: z.string().nonempty(),
}));

/**
 * Expected response for the /shop/:guid/tickets API.
 * @see https://docs.weeztix.com/api/dashboard/get-shop-specific-ticket
 */
export type GetShopTicketTypesResponse = z.infer<typeof kGetShopTicketTypesResponse>;

/**
 * Expected response for the /shop/{type?} API.
 * @see https://docs.weeztix.com/api/dashboard/get-shops
 */
export const kGetShopsResponse = z.array(z.object({
    guid: z.string().nonempty(),
    name: z.string().nonempty(),
}));

/**
 * Expected response for the /shop/{type?} API.
 * @see https://docs.weeztix.com/api/dashboard/get-shops
 */
export type GetShopsResponse = z.infer<typeof kGetShopsResponse>;

/**
 * Expected response for the /event/:guid/ticket/products API.
 * @see https://docs.weeztix.com/api/dashboard/get-event-tickets
 */
export const kGetTicketTypesResponse = z.array(z.object({
    guid: z.string().nonempty(),
    event_id: z.string().nonempty(),
    name: z.string().nonempty(),
    description: z.string().nullish(),
    min_price: z.number(),
    available_stock: z.number(),
    sold_count: z.number(),
    scanned_count: z.number(),
    available_from: z.iso.datetime({ offset: true }).nullish(),
    available_until: z.iso.datetime({ offset: true }).nullish(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    status: z.enum([ 'sold_out', 'not_sold_right_now', 'available', 'auto' ]),
    include_service_cost_in_price: z.boolean().nullish(),

    // 0 or more:
    products: z.array(z.object({
        guid: z.string().nonempty(),
        event_id: z.string().nonempty(),
        origin_type: z.enum([ 'product', 'ticket' ]),
        name: z.string().nonempty(),
        description: z.string().nullish(),
        price: z.number(),
        available_stock: z.number(),
        sold_count: z.number(),
        scanned_count: z.number(),
        status: z.enum([ 'sold_out', 'not_sold_right_now', 'available', 'auto' ]),
    })),
}));

/**
 * Expected response for the /event/:guid/ticket/products API.
 */
export type GetTicketTypesResponse = z.infer<typeof kGetTicketTypesResponse>;

/**
 * Expected response for ticket OrderMetadata creation and update APIs.
 * @see https://docs.weeztix.com/api/dashboard/create-order-ticket-metadata
 * @see https://docs.weeztix.com/api/dashboard/update-order-ticket-metadata
 */
export const kOrderTicketMetadataResponse = kOrderMetadataSchema;

/**
 * Expected response for ticket OrderMetadata creation and update APIs.
 */
export type OrderTicketMetadataResponse = z.infer<typeof kOrderTicketMetadataResponse>;

/**
 * Request payload for the POST /order/:guid/tickets/:order_ticket_guid/metadata API.
 * @see https://docs.weeztix.com/api/dashboard/create-order-ticket-metadata
 */
export const kPostOrderTicketMetadataRequest = z.object({
    metadata_id: z.string().nonempty(),
    value: z.string(),
});

/**
 * Request payload for the POST /order/:guid/tickets/:order_ticket_guid/metadata API.
 */
export type PostOrderTicketMetadataRequest = z.infer<typeof kPostOrderTicketMetadataRequest>;

/**
 * Request payload for the POST /statistics/orders/:company_guid API.
 * @see https://docs.weeztix.com/api/dashboard/get-company-orders
 */
export const kPostStatisticsOrdersRequest = z.object({
    offset: z.number().int(),
    limit: z.number().int(),
    timeunit: z.enum([ 'year', 'month', 'week', 'day', 'hour' ]),
    range_applies_to: z.enum([ 'created_at', 'updated_at' ]).optional(),
    statii: z.array(z.enum([ 'swapped', 'paid', 'cancelled', 'expired', 'pending' ])).optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    filters: z.string().optional(),
    events: z.array(z.string()).optional(),
    sorting: z.record(z.string(), z.enum([ 'asc', 'desc' ])).optional(),
    purchase_channels: z.array(
        z.enum([ 'shop', 'import', 'guestlist', 'cashr', 'api', 'swap' ])).optional(),
});

/**
 * Request payload for the POST /statistics/orders/:company_guid API.
 */
export type PostStatisticsOrdersRequest = z.infer<typeof kPostStatisticsOrdersRequest>;

/**
 * Schema associated with metadata fields.
 * @see https://docs.weeztix.com/api/dashboard/get-order-specific/
 */
export const kMetadataSchema = z.object({
    metadata_id: z.string().nonempty(),
    value: z.string().or(z.number()).or(z.boolean()),
});

/**
 * Schema associated with an individual product.
 * @see https://docs.weeztix.com/api/dashboard/get-order-specific/
 */
export const kProductSchema = z.object({
    guid: z.string().nonempty(),
    finn_inner_value: z.number(),  // price of the product, without service fees
    finn_service_fee: z.number(),  // price of any charged service fees
    finn_price: z.number(),  // price of the product, inclusive of and service fees
    product_id: z.string().nonempty(),
    origin_type: z.enum([ 'product', 'ticket' ]),
    invalidated_since: z.iso.datetime({ offset: true }).nullish(),
    invalidated_reason: z.string().nullish(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    meta_data: z.array(kMetadataSchema),
});

/**
 * Schema associated with an individual ticket.
 * @see https://docs.weeztix.com/api/dashboard/get-order-specific/
 */
export const kTicketSchema = z.object({
    guid: z.string().nonempty(),
    finn_value: z.number(),  // price of the ticket, without add-on products or service fees
    finn_inner_value: z.number(),  // price of any additional add-on products
    finn_service_fee: z.number(),  // price of any charged service fees
    finn_price: z.number(),  // price of the ticket, add-on products and service fees
    ticket_id: z.string().nonempty(),
    ticket_number: z.string(),  // barcode
    invalidated_since: z.iso.datetime({ offset: true }).nullish(),
    invalidated_reason: z.string().nullish(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    meta_data: z.array(kMetadataSchema),

    // 0 or more:
    products: z.array(kProductSchema),
});

/**
 * Schema associated with an individual order.
 * @see https://docs.weeztix.com/api/dashboard/get-order-specific/
 */
export const kOrderSchema = z.object({
    guid: z.string().nonempty(),
    // email: z.string(),
    status: z.string(),
    invalidated_since: z.iso.datetime({ offset: true }).nullish(),
    invalidated_reason: z.string().nullish(),
    fullname: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),

    // 0 or more:
    products: z.array(kProductSchema),

    // 0 or more:
    tickets: z.array(kTicketSchema),

    tech_data: z.object({
        utm_source: z.string().nullish(),
        utm_medium: z.string().nullish(),
        utm_campaign: z.string().nullish(),
        utm_term: z.string().nullish(),
    }),
});

/**
 * Schema for an individual order.
 */
export type Order = z.infer<typeof kOrderSchema>;

/**
 * Response payload from the POST /statistics/orders/:company_guid API.
 * @see https://docs.weeztix.com/api/dashboard/get-company-orders
 */
export const kPostStatisticsOrdersResponse = z.object({
    hits: z.object({
        total: z.number(),
        hits: z.array(z.object({
            _source: kOrderSchema,
        })),
    }),
});

/**
 * Response payload for the POST /statistics/orders/:company_guid API.
 */
export type PostStatisticsOrdersResponse = z.infer<typeof kPostStatisticsOrdersResponse>;

/**
 * Request payload for the PUT /order/:guid API.
 * @see https://docs.weeztix.com/api/dashboard/update-order-receiver-information
 */
export const kPutOrderReceiverRequest = z.object({
    email: z.email().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    locale: z.string().optional(),
});

/**
 * Request payload for the PUT /order/:guid API.
 */
export type PutOrderReceiverRequest = z.infer<typeof kPutOrderReceiverRequest>;

/**
 * Expected response for the PUT /order/:guid API.
 * @see https://docs.weeztix.com/api/dashboard/update-order-receiver-information
 */
export const kPutOrderReceiverResponse = z.object({
    guid: z.string().nonempty(),
    email: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    fullname: z.string().nullish(),
    locale: z.string().nullish(),
    status: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
});

/**
 * Expected response for the PUT /order/:guid API.
 */
export type PutOrderReceiverResponse = z.infer<typeof kPutOrderReceiverResponse>;

/**
 * Request payload for the PUT /order/:guid/tickets/:ticket_guid/metadata/:metadata_guid API.
 * @see https://docs.weeztix.com/api/dashboard/update-order-ticket-metadata
 */
export const kPutOrderTicketMetadataRequest = z.object({
    value: z.string(),
});

/**
 * Request payload for the PUT /order/:guid/tickets/:ticket_guid/metadata/:metadata_guid API.
 */
export type PutOrderTicketMetadataRequest = z.infer<typeof kPutOrderTicketMetadataRequest>;

/**
 * Expected response when refreshing the OAuth token.
 * @see https://docs.weeztix.com/docs/introduction/authentication/refresh-token
 */
export const kRefreshTokenResponse = z.object({
    token_type: z.literal('Bearer'),
    expires_in: z.number(),
    access_token: z.string().nonempty(),
    refresh_token: z.string().nonempty(),
    refresh_token_expires_in: z.number(),
});
