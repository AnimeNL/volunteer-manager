// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Type definition for the request parameters for a ticket creation request.
 */
export const kCreateTicketRequest = z.object({
    EventId: z.number(),
    Email: z.email(),
    IncludeTicketGuarantee: z.literal(false),
    Language: z.string().nonempty(),
    Complimentary: z.literal(true),
    HasAcceptedTermsAndAgreements: z.literal(true),
    PurchaseItems: z.array(z.object({
        TicketId: z.number(),
        TicketHolderEmail: z.email(),
        TicketHolderFirstname: z.string().nonempty(),
        TicketHolderLastname: z.string().nonempty(),
        TicketHolderOrganisation: z.string().optional(),
        TicketHolderDepartment: z.string().optional(),
        TicketHolderPosition: z.string().optional(),
    })),
});

/**
 * Interface describing the data we need in order to create a new ticket.
 */
export type CreateTicketRequest = z.infer<typeof kCreateTicketRequest>;

/**
 * Type definition for the response parameters for a ticket creation request.
 */
export const kCreateTicketResponse = z.object({
    Id: z.number(),
    EventId: z.number(),
    IsTicketClaimRequired: z.boolean(),
    TicketClaimUrl: z.string().nullish(),
    TotalAmount: z.number(),
    Reference: z.string(),
    PaymentUrl: z.string().nullish(),
    Secret: z.string(),
    Paid: z.boolean(),
    PaidDate: z.iso.datetime(),
    Complimentary: z.boolean(),
    Cancelled: z.boolean(),
});

/**
 * Interface describing the data we retrieve after having created a new ticket.
 */
export type CreateTicketResponse = z.infer<typeof kCreateTicketResponse>;

/**
 * Type definition for YourTicketProvider's response when querying event responses.
 */
export const kOrganiserEventResponse = z.object({
    value: z.array(z.object({
        Id: z.number(),
        Name: z.string(),
        Description: z.string(),
        Live: z.boolean(),
        LocationName: z.string(),
        StartDateTime: z.iso.datetime(),
        EndDateTime: z.iso.datetime(),
    })),
});

/**
 * Interface describing the data we expect from the Organiser Events API.
 */
export type OrganiserEventResponse = z.infer<typeof kOrganiserEventResponse>['value'];

/**
 * Type definition that defines the response we expect when calling the Organisers API.
 */
export const kOrganisersResponse = z.object({
    value: z.array(z.object({
        Id: z.number(),
        FirstName: z.string(),
        LastName: z.string(),
        Email: z.string(),
        ApiKey: z.string().nullable(),
    })),
});

/**
 * Interface describing the data we expect from the Organisers API.
 */
export type OrganisersResponse = z.infer<typeof kOrganisersResponse>['value'];

/**
 * Type definition for the response expected from the sales queue API.
 */
export const kQueueNeededResponse = z.object({
    /**
     * Number of seconds we have to wait prior to making a purchase.
     */
    queueTimeInSeconds: z.number(),
});

/**
 * Interface describing the response expected from the sales queue API.
 */
export type QueueNeededResponse = z.infer<typeof kOrganisersResponse>['value'];

/**
 * Type definition that defines the response we expect when calling the Tickets API.
 */
export const kTicketsResponse = z.object({
    value: z.array(z.object({
        Id: z.number(),
        Name: z.string(),
        Description: z.string().optional(),
        Price: z.number(),
        Amount: z.number(),
        CurrentAvailable: z.number().nullable(),
        Live: z.boolean(),
        IsSubproduct: z.boolean(),
    })),
});

/**
 * Interface describing the data we expect from the Tickets API.
 */
export type TicketsResponse = z.infer<typeof kTicketsResponse>['value'];
