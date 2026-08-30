// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { LogPayloadAllowedTypes } from './LogTypes';

/**
 * Utility type to indicate that no parameters are required for a particular log type.
 */
type NoParameters = Record<string, never>;

/**
 * Parameters that must be given for each of the log types.
 */
interface LogTypeParameterMap {
    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard > Communication
    // ---------------------------------------------------------------------------------------------

    PublishSubscriptionTest: NoParameters;

    UpdateAccountSubscriptions: {
        added: string[];
        updated: string[];
        removed: string[];
    };

    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard > System
    // ---------------------------------------------------------------------------------------------

    CreateEmailAddress: {
        address: string;
    };

    CreateLogMessageFormat: {
        type: string;
    };

    CreateSchedulerTask: {
        taskName: string;
    };

    DeleteEmailAddress: {
        address: string;
    };

    RepeatSchedulerTask: {
        taskId: number;
        taskName: string;
        repeatedTaskId: number;
    };

    UpdateAiPrompt: {
        prompt: string;
    };

    UpdateContent: {
        context: string;
        mutation: string;
    };

    UpdateEmailAddress: {
        address: string;
    };

    UpdateIntegrationSettings: {
        integration:
            'AnimeCon' | 'Email' | 'Generative AI' | 'Google' | 'Twilio' | 'Weeztix' |
            'YourTicketProvider';
    };

    UpdateLogMessageFormat: {
        type: string;
    };

    UpdateSystemSettings: {
        updated: string[];
    };

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation
    // ---------------------------------------------------------------------------------------------

    CreateExport: {
        event: string;  // short name
        type: string;
    };

    ExpireExport: {
        event: string;  // short name
        type: string;
    };

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation > Accounts
    // ---------------------------------------------------------------------------------------------

    AccountRegister: NoParameters;

    AdminAnonymizeAccount: NoParameters;

    AdminDeleteAvatar: NoParameters;

    AdminImpersonateVolunteer: NoParameters;

    AdminResetAccessCode: NoParameters;

    AdminResetPasswordLink: NoParameters;

    AdminSuspendVolunteer: {
        action: 'Restricted' | 'Unrestricted';
    };

    AdminUpdateActivation: {
        action: 'Activated' | 'Deactived';
    };

    AdminUpdateAvatar: NoParameters;

    AdminUpdatePermission: {
        grants: string;
        revokes: string;
        events: string;
        teams: string;
    };

    AdminUpdateVolunteer: NoParameters;

    AdminVerifyDiscord: NoParameters;

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation > People & teams
    // ---------------------------------------------------------------------------------------------

    RespondToFeedback: {
        action: string;  // Acknowledged | Archived | Declined | Resolved
    };

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation > Services
    // ---------------------------------------------------------------------------------------------

    CreateNardoAdvice: NoParameters;

    DeleteNardoAdvice: NoParameters;

    UpdateNardoAdvice: NoParameters;

    // ---------------------------------------------------------------------------------------------
    // Administration > Volunteers
    // ---------------------------------------------------------------------------------------------

    AnonymizeRefundRequests: {
        event: string;  // short name
    };

    AnonymizeVisitorTickets: {
        event: string;  // short name
    };

    AssociateTicketWithVolunteer: {
        event: string;  // short name
    };

    CancelAssociateTicket: {
        event: string;  // short name
        recipient: string;
        purchaseId: number | string;
    };

    CancelVolunteerTicket: {
        event: string;  // short name
        purchaseId: number | string;
    };

    CreateAssociateTicket: {
        event: string;  // short name
        recipient: string;
        purchaseId: number | string;
    };

    CreateEventKeyDate: {
        event: string;  // short name
    };

    DeleteEventKeyDate: {
        event: string;  // short name
        title: string;
    };

    DisassociateTicketFromVolunteer: {
        event: string;  // short name
    };

    ResendTicketConfirmation: {
        event: string;  // short name
        purchaseId: string | number;
    };

    UpdateAssociateTicket: {
        event: string;  // short name
        recipient: string;
        purchaseId: number | string;
    };

    UpdateEventImage: {
        event: string;  // short name
    };

    UpdateEventKeyDate: {
        event: string;  // short name
        title: string;
    };

    UpdateEventProductAssociation: {
        event: string;  // short name
        product: string;
    };

    UpdateEventPublicationStatus: {
        event: string;  // short name
        status: 'Published' | 'Suspended';
    };

    UpdateEventSettings: {
        event: string;  // short name
        type: 'basic' | 'feature' | 'integration' | 'ticketing';
    };

    UpdateEventSlug: {
        event: string;  // short name
        oldSlug: string;
        newSlug: string;
    };

    UpdateEventTeamParticipation: {
        event: string;  // short name
        team: string;  // name
    };

    UpdateKnowledgeBase: {
        event: string;  // short name
        question: string;
        mutation: string;
    };

    UpdateTicketPurchase: {
        event: string;  // short name
        purchaseId: string;
    };

    // ---------------------------------------------------------------------------------------------
    // Administration > Volunteers > Team
    // ---------------------------------------------------------------------------------------------

    ClaimApplication: {
        event: string;  // short name
        team: string;  // title ("Volunteering Crew")
    };

    CreateApplication: {
        event: string;  // short name
        team: string;  // title ("Volunteering Crew")
    };

    CreateShift: {
        event: string;  // short name
        team: string;  // title
        shift: string;  // name
    };

    CreateVendor: {
        event: string;  // short name
        vendor: string;
        name: string;
    };

    DecideApplication: {
        event: string;  // short name
        team: string;  // title ("Volunteering Crew")
        verdict: 'Accepted' | 'Rejected';
    };

    DeleteDutyBookIncident: {
        event: string;  // short name
        incidentId: number;
    };

    DeleteShift: {
        event: string;  // short name
        team: string;  // title
        shift: string;  // name
    };

    DeleteVendor: {
        event: string;  // short name
        vendor: string;
        name: string;
    };

    MoveApplication: {
        team: string;  // short name
    };

    ReconsiderApplication: {
        event: string;  // short name
        team: string;  // title ("Volunteering Crew")
    };

    RecordRetentionOutreach: {
        event: string;  // short name
        channel: 'e-mail' | 'WhatsApp';
    };

    ReleaseApplication: {
        event: string;  // short name
        team: string;  // title ("Volunteering Crew")
    };

    UpdateApplicationOverrides: {
        event: string;  // short name
    };

    UpdateDutyBookIncident: {
        event: string;  // short name
        incidentId: number;
    };

    UpdateDutyBookIncidentVisibility: {
        event: string;  // short name
        incidentId: number;
    };

    UpdateRetention: {
        event: string;  // short name
    };

    UpdateShift: {
        event: string;  // short name
        team: string;  // title
        shift: string;  // name
    };

    UpdateShiftDemand: {
        event: string;  // short name
        team: string;  // title
        shift: string;  // name
    };

    UpdateVendor: {
        event: string;  // short name
        vendor: string;
        name: string;
    };

    UpdateVendorSchedule: {
        event: string;  // short name
        vendor: string;
    };

    UpdateVolunteerNotes: {
        event: string;  // short name
        team: string;  // title
    };

    UpdateVolunteerRole: {
        event: string;  // short name
        role: string;  // name
        team: string;  // title
    };

    UpdateVolunteerStatus: {
        action: 'Cancelled' | 'Reinstated';
        event: string;  // short name
        team: string;  // title
    };

    UpdateVolunteerTeam: {
        event: string;  // short name
        sourceTeam: string;  // name
        targetTeam: string;  // name
    };

    // ---------------------------------------------------------------------------------------------
    // Registration portal:
    // ---------------------------------------------------------------------------------------------

    UpdateAvailabilityPreferences: {
        event: string;  // short name
        team: string;  // title
    };

    UpdateHotelPreferences: {
        event: string;  // short name
    };

    UpdateParticipationPreferences: {
        event: string;  // short name
    };

    UpdateRefundPreferences: {
        event: string;  // short name
    };

    UpdateTrainingPreferences: {
        event: string;  // short name
    };

    // ---------------------------------------------------------------------------------------------
    // Log types that should only be used for internal purposes:
    // ---------------------------------------------------------------------------------------------

    TestWithParameters: {
        firstName: string;
        age: number;
    };

    TestWithoutParameters: NoParameters;

    // ---------------------------------------------------------------------------------------------
    // Deprecated descriptors that should no longer be used:
    // ---------------------------------------------------------------------------------------------

    // TODO: None yet
}

/**
 * Set of unique names of log messages that can be recorded.
 */
export type LogType = keyof LogTypeParameterMap;

/**
 * Acquire the parameters that are required for a log message of type `T`.
 */
export type LogTypeParameters<T extends LogType> = LogTypeParameterMap[T];

/**
 * Names of the log types that exist in the system.
 */
export const kLogType: { [k in LogType]: k } = {
    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard > Communication
    // ---------------------------------------------------------------------------------------------

    PublishSubscriptionTest: 'PublishSubscriptionTest',
    UpdateAccountSubscriptions: 'UpdateAccountSubscriptions',

    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard > System
    // ---------------------------------------------------------------------------------------------

    CreateEmailAddress: 'CreateEmailAddress',
    CreateLogMessageFormat: 'CreateLogMessageFormat',
    CreateSchedulerTask: 'CreateSchedulerTask',
    DeleteEmailAddress: 'DeleteEmailAddress',
    RepeatSchedulerTask: 'RepeatSchedulerTask',
    UpdateAiPrompt: 'UpdateAiPrompt',
    UpdateContent: 'UpdateContent',
    UpdateEmailAddress: 'UpdateEmailAddress',
    UpdateIntegrationSettings: 'UpdateIntegrationSettings',
    UpdateLogMessageFormat: 'UpdateLogMessageFormat',
    UpdateSystemSettings: 'UpdateSystemSettings',

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation
    // ---------------------------------------------------------------------------------------------

    CreateExport: 'CreateExport',
    ExpireExport: 'ExpireExport',

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation > Accounts
    // ---------------------------------------------------------------------------------------------

    AccountRegister: 'AccountRegister',
    AdminAnonymizeAccount: 'AdminAnonymizeAccount',
    AdminDeleteAvatar: 'AdminDeleteAvatar',
    AdminImpersonateVolunteer: 'AdminImpersonateVolunteer',
    AdminResetAccessCode: 'AdminResetAccessCode',
    AdminResetPasswordLink: 'AdminResetPasswordLink',
    AdminSuspendVolunteer: 'AdminSuspendVolunteer',
    AdminUpdateActivation: 'AdminUpdateActivation',
    AdminUpdateAvatar: 'AdminUpdateAvatar',
    AdminUpdatePermission: 'AdminUpdatePermission',
    AdminUpdateVolunteer: 'AdminUpdateVolunteer',
    AdminVerifyDiscord: 'AdminVerifyDiscord',

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation > People & teams
    // ---------------------------------------------------------------------------------------------

    RespondToFeedback: 'RespondToFeedback',

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation > Services
    // ---------------------------------------------------------------------------------------------

    CreateNardoAdvice: 'CreateNardoAdvice',
    DeleteNardoAdvice: 'DeleteNardoAdvice',
    UpdateNardoAdvice: 'UpdateNardoAdvice',

    // ---------------------------------------------------------------------------------------------
    // Administration > Volunteers
    // ---------------------------------------------------------------------------------------------

    AnonymizeRefundRequests: 'AnonymizeRefundRequests',
    AnonymizeVisitorTickets: 'AnonymizeVisitorTickets',
    AssociateTicketWithVolunteer: 'AssociateTicketWithVolunteer',
    CancelAssociateTicket: 'CancelAssociateTicket',
    CancelVolunteerTicket: 'CancelVolunteerTicket',
    CreateAssociateTicket: 'CreateAssociateTicket',
    CreateEventKeyDate: 'CreateEventKeyDate',
    DeleteEventKeyDate: 'DeleteEventKeyDate',
    DisassociateTicketFromVolunteer: 'DisassociateTicketFromVolunteer',
    ResendTicketConfirmation: 'ResendTicketConfirmation',
    UpdateAssociateTicket: 'UpdateAssociateTicket',
    UpdateEventImage: 'UpdateEventImage',
    UpdateEventKeyDate: 'UpdateEventKeyDate',
    UpdateEventProductAssociation: 'UpdateEventProductAssociation',
    UpdateEventPublicationStatus: 'UpdateEventPublicationStatus',
    UpdateEventSettings: 'UpdateEventSettings',
    UpdateEventSlug: 'UpdateEventSlug',
    UpdateEventTeamParticipation: 'UpdateEventTeamParticipation',
    UpdateKnowledgeBase: 'UpdateKnowledgeBase',
    UpdateTicketPurchase: 'UpdateTicketPurchase',

    // ---------------------------------------------------------------------------------------------
    // Administration > Volunteers > Team
    // ---------------------------------------------------------------------------------------------

    ClaimApplication: 'ClaimApplication',
    CreateApplication: 'CreateApplication',
    CreateShift: 'CreateShift',
    CreateVendor: 'CreateVendor',
    DecideApplication: 'DecideApplication',
    DeleteDutyBookIncident: 'DeleteDutyBookIncident',
    DeleteShift: 'DeleteShift',
    DeleteVendor: 'DeleteVendor',
    MoveApplication: 'MoveApplication',
    ReconsiderApplication: 'ReconsiderApplication',
    RecordRetentionOutreach: 'RecordRetentionOutreach',
    ReleaseApplication: 'ReleaseApplication',
    UpdateApplicationOverrides: 'UpdateApplicationOverrides',
    UpdateDutyBookIncident: 'UpdateDutyBookIncident',
    UpdateDutyBookIncidentVisibility: 'UpdateDutyBookIncidentVisibility',
    UpdateRetention: 'UpdateRetention',
    UpdateShift: 'UpdateShift',
    UpdateShiftDemand: 'UpdateShiftDemand',
    UpdateVendor: 'UpdateVendor',
    UpdateVendorSchedule: 'UpdateVendorSchedule',
    UpdateVolunteerNotes: 'UpdateVolunteerNotes',
    UpdateVolunteerRole: 'UpdateVolunteerRole',
    UpdateVolunteerStatus: 'UpdateVolunteerStatus',
    UpdateVolunteerTeam: 'UpdateVolunteerTeam',

    // ---------------------------------------------------------------------------------------------
    // Registration portal:
    // ---------------------------------------------------------------------------------------------

    UpdateAvailabilityPreferences: 'UpdateAvailabilityPreferences',
    UpdateHotelPreferences: 'UpdateHotelPreferences',
    UpdateParticipationPreferences: 'UpdateParticipationPreferences',
    UpdateRefundPreferences: 'UpdateRefundPreferences',
    UpdateTrainingPreferences: 'UpdateTrainingPreferences',

    // ---------------------------------------------------------------------------------------------
    // Log types that should only be used for internal purposes:
    // ---------------------------------------------------------------------------------------------

    TestWithParameters: 'TestWithParameters',
    TestWithoutParameters: 'TestWithoutParameters',

    // ---------------------------------------------------------------------------------------------
    // Deprecated descriptors that should no longer be used
    // ---------------------------------------------------------------------------------------------

    // TODO: None yet
};

// -------------------------------------------------------------------------------------------------

/**
 * Utility type that substitutes and invalid log type parameter types with `never`.
 */
type ValidateLogTypeParameterMap<T> = {
    [K in keyof T]: T[K] extends Record<string, any>
        ? { [P in keyof T[K]]: T[K][P] extends LogPayloadAllowedTypes ? T[K][P] : never }
        : T[K];
};

/**
 * Utility type that asserts whether the `LogTypeParameterMap` does not contain any `never` types.
 */
type AssertValidLogTypeParameterMap =
    LogTypeParameterMap extends ValidateLogTypeParameterMap<LogTypeParameterMap> ? true : never;

/**
 * Actual assertion that the `LogTypeParameterMap` only contains valid payload types.
 *
 * If a compile error is generated by this line, then the `LogTypeParameterMap` contains one or more
 * log types that contain a payload not conformant to the `LogPayloadAllowedTypes` type -- most
 * likely something that was just added.
 *
 * Log message payloads only allow plain key-value data types as the metadata is intended for
 * display in a user interface. Additional types can be added, but then the UI needs to be updated.
 */
const __assertValidLogTypeParameterMap: AssertValidLogTypeParameterMap = true;
