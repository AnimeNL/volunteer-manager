// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Type definition that defines the response we expect when calling the Organisers API.
 */
export const kYourTicketProviderOrganisersResponse = z.object({
    /**
     * Array of the response values.
     */
    value: z.array(z.object({
        /**
         * Unique ID of the organiser for whom information is being returned.
         */
        Id: z.number(),

        /**
         * First name of the organiser.
         */
        FirstName: z.string(),

        /**
         * Last name of the organiser.
         */
        LastName: z.string(),

        /**
         * E-mail address through which the organiser can be reached.
         */
        Email: z.string(),

        /**
         * API key that belongs to this organiser.
         */
        ApiKey: z.string().nullable(),
    })),
});

/**
 * Interface describing the data we expect from the Organisers API.
 */
export type YourTicketProviderOrganisersResponse =
    z.infer<typeof kYourTicketProviderOrganisersResponse>['value'];

/**
 * Type definition that defines the response we expect when calling the Tickets API.
 */
export const kYourTicketProviderTicketsResponse = z.object({
    /**
     * Array of response values.
     */
    value: z.array(z.object({
        /**
         * Unique ID of the product as it's known to YourTicketProvider.
         */
        Id: z.number(),

        /**
         * Name of the product.
         */
        Name: z.string(),

        /**
         * Optional description associated with the product.
         */
        Description: z.string().optional(),

        /**
         * Price of the product, in the event's local currency.
         */
        Price: z.number(),

        /**
         * Total number of times that this product can be purchased.
         */
        Amount: z.number(),

        /**
         * Number of times that this product can still be purchased. This also considers tickets
         * that were issued from non-sales, e.g. people being on the guest list. Will be set to NULL
         * when no further tickets are available.
         */
        CurrentAvailable: z.number().nullable(),

        /**
         * Whether the product is still live. Products that aren't will be ignored, as their sales
         * information no longer is accurate.
         */
        Live: z.boolean(),

        /**
         * Whether this is a ticket (`false`) or a subproduct (`true`).
         */
        IsSubproduct: z.boolean(),
    })),
});

/**
 * Interface describing the data we expect from the Tickets API.
 */
export type YourTicketProviderTicketsResponse =
    z.infer<typeof kYourTicketProviderTicketsResponse>['value'];
