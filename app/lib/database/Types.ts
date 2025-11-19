// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { LogSeverity } from '@lib/Log';

/**
 * @deprecated Use the `LogSeverity` type from the `@lib/Log` module instead.
 */
export type { LogSeverity };

/**
 * Lists the values of a given type.
 */
type Values<T> = T[keyof T];

/**
 * Type of entry in the database program tables.
 * @see Table `activities`
 * @see Table `activities_timeslots`
 */
export type ActivityType = Values<typeof kActivityType>;
export const kActivityType = {
    Program: 'Program',
    Internal: 'Internal',
} as const;

/**
 * Type of authentication credential that is stored in the value column.
 * @see Table `users_auth`
 */
export type AuthType = Values<typeof kAuthType>;
export const kAuthType = {
    code: 'code',
    passkey: 'passkey',
    password: 'password',
} as const;

/**
 * Type of content that's stored within a particular scope.
 * @see Table `content`
 */
export type ContentType = Values<typeof kContentType>;
export const kContentType = {
    FAQ: 'FAQ',
    Page: 'Page',
} as const;

/**
 * Type of event-associated date an entry represents.
 * @see Table `events_dates`
 */
export type DateType = Values<typeof kDateType>;
export const kDateType = {
    Deadline: 'Deadline',
    Highlight: 'Highlight',
} as const;

/**
 * Status of a help request issued by one of the displays.
 * @see Table `displays`
 */
export type DisplayHelpRequestStatus = Values<typeof kDisplayHelpRequestStatus>;
export const kDisplayHelpRequestStatus = {
    Pending: 'Pending',
    Acknowledged: 'Acknowledged',
} as const;

/**
 * Target of a help request issued by one of the displays.
 * @see Table `displays_requests`
 */
export type DisplayHelpRequestTarget = Values<typeof kDisplayHelpRequestTarget>;
export const kDisplayHelpRequestTarget = {
    Crew: 'Crew',
    Nardo: 'Nardo',
    Stewards: 'Stewards',
} as const;

/**
 * Purpose of an environment that defines what happens when someone visits them.
 * @see Table `environments`
 */
export type EnvironmentPurpose = Values<typeof kEnvironmentPurpose>;
export const kEnvironmentPurpose = {
    LandingPage: 'LandingPage',
    Placeholder: 'Placeholder',
} as const;

/**
 * Status indicating whether volunteers can share their availability preferences.
 * @see Table `events`
 */
export type EventAvailabilityStatus = Values<typeof kEventAvailabilityStatus>;
export const kEventAvailabilityStatus = {
    Unavailable: 'Unavailable',
    Available: 'Available',
    Locked: 'Locked',
} as const;

/**
 * Sales categories that can be independently tracked and displayed in finance dashboards.
 * @see Table `events_sales_configuration`
 */
export type EventSalesCategory = Values<typeof kEventSalesCategory>;
export const kEventSalesCategory = {
    Event: 'Event',
    Hidden: 'Hidden',
    Locker: 'Locker',
    LockerFriday: 'LockerFriday',
    LockerSaturday: 'LockerSaturday',
    LockerSunday: 'LockerSunday',
    LockerWeekend: 'LockerWeekend',
    TicketFriday: 'TicketFriday',
    TicketSaturday: 'TicketSaturday',
    TicketSunday: 'TicketSunday',
    TicketWeekend: 'TicketWeekend'
} as const;

/**
 * Type of export that a particular entry describes.
 * @see Table `exports`
 */
export type ExportType = Values<typeof kExportType>;
export const kExportType = {
    BuildUp: 'BuildUp',
    Credits: 'Credits',
    Discord: 'Discord',
    Refunds: 'Refunds',
    TearDown: 'TearDown',
    Trainings: 'Trainings',
    Volunteers: 'Volunteers',
    WhatsApp: 'WhatsApp',
} as const;

/**
 * Type of response that can be given to received feedback.
 * @see Table `feedback`
 */
export type FeedbackResponse = Values<typeof kFeedbackResponse>;
export const kFeedbackResponse = {
    Acknowledged: 'Acknowledged',
    Archived: 'Archived',
    Declined: 'Declined',
    Resolved: 'Resolved',
};

/**
 * Type of content that's stored within the storage buffer.
 * @see Table `storage`
 */
export type FileType = Values<typeof kFileType>;
export const kFileType = {
    Avatar: 'Avatar',
    EventIdentity: 'EventIdentity',
} as const;

/**
 * The type of (activity) mutation that happened in the AnPlan program.
 * @see Table `activities_logs`
 * @see Table `schedule_logs`
 */
export type Mutation = Values<typeof kMutation>;
export const kMutation = {
    Created: 'Created',
    Updated: 'Updated',
    Deleted: 'Deleted',
} as const;

/**
 * The severity of the (activity) mutation that happened in the AnPlan program.
 * @see Table `activities_logs`
 */
export type MutationSeverity = Values<typeof kMutationSeverity>;
export const kMutationSeverity = {
    Low: 'Low',
    Moderate: 'Moderate',
    Important: 'Important',
} as const;

/**
 * Type of message that is being logged by the Twilio table.
 * @see Table `outbox_twilio`
 */
export type TwilioOutboxType = Values<typeof kTwilioOutboxType>;
export const kTwilioOutboxType = {
    SMS: 'SMS',
    WhatsApp: 'WhatsApp',
} as const;

/**
 * Status of a volunteer's registration to an event.
 * @see Table `users_events`
 */
export type RegistrationStatus = Values<typeof kRegistrationStatus>;
export const kRegistrationStatus = {
    Registered: 'Registered',
    Cancelled: 'Cancelled',
    Accepted: 'Accepted',
    Rejected: 'Rejected',
} as const;

/**
 * Status of reaching out regarding a volunteer's retention.
 * @see Table `retention`
 */
export type RetentionStatus = Values<typeof kRetentionStatus>;
export const kRetentionStatus = {
    Contacting: 'Contacting',
    Declined: 'Declined',
} as const;

/**
 * Degree of expected overlap for the scheduled demand of a shift.
 * @see Table `shifts`
 */
export type ShiftDemandOverlap = Values<typeof kShiftDemandOverlap>;
export const kShiftDemandOverlap = {
    None: 'None',
    Partial: 'Partial',
    Cover: 'Cover',
} as const;

/**
 * Fit of a t-shirt that a volunteer has requested in a registration.
 * @see Table `users_events`
 * @see Table `vendors`
 */
export type ShirtFit = Values<typeof kShirtFit>;
export const kShirtFit = {
    Regular: 'Regular',
    Girly: 'Girly',
} as const;

/**
 * Size of a t-shirt that a volunteer has requested in a registration.
 * @see Table `users_events`
 * @see Table `vendors`
 */
export type ShirtSize = Values<typeof kShirtSize>;
export const kShirtSize = {
    XS: 'XS',
    S: 'S',
    M: 'M',
    L: 'L',
    XL: 'XL',
    XXL: 'XXL',
    '3XL': '3XL',
    '4XL': '4XL',
} as const;

/**
 * Types of subscriptions that can be created for eligible users.
 * @see Table `subscriptions`
 */
export type SubscriptionType = Values<typeof kSubscriptionType>;
export const kSubscriptionType = {
    Application: 'Application',
    Help: 'Help',
    Registration: 'Registration',
    Test: 'Test',
} as const;

/**
 * Possible results that can occur when running tasks.
 */
export type TaskResult = Values<typeof kTaskResult>;
export const kTaskResult = {
    TaskSuccess: 'TaskSuccess',
    TaskException: 'TaskException',
    TaskFailure: 'TaskFailure',
    InvalidNamedTask: 'InvalidNamedTask',
    InvalidParameters: 'InvalidParameters',
    InvalidTaskId: 'InvalidTaskId',
    UnknownFailure: 'UnknownFailure',
} as const;

/**
 * Webhook endpoint that was posted to from the Twilio infrastructure.
 * @see Table `twilio_webhook_calls`
 */
export type TwilioWebhookEndpoint = Values<typeof kTwilioWebhookEndpoint>;
export const kTwilioWebhookEndpoint = {
    Inbound: 'Inbound',
    Outbound: 'Outbound',
} as const;

/**
 * Gender of a vendor, simplified display.
 * @see Table `vendors`
 */
export type VendorGender = Values<typeof kVendorGender>;
export const kVendorGender = {
    Female: 'Female',
    Other: 'Other',
    Male: 'Male',
} as const;

/**
 * The team that a vendor can be part of.
 * @see Table `vendors`
 */
export type VendorTeam = Values<typeof kVendorTeam>;
export const kVendorTeam = {
    FirstAid: 'first-aid',
    Security: 'security',
} as const;
