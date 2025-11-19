// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ConfirmIdentityDefinition } from '@app/api/auth/confirmIdentity';
import type { CreateChallengeDefinition } from '@app/api/auth/passkeys/createChallenge';
import type { CreateEventDefinition } from '@app/api/admin/createEvent';
import type { CreateScheduleEntryDefinition } from '@app/api/admin/event/schedule/createScheduleEntry';
import type { DeletePasskeyDefinition } from '@app/api/auth/passkeys/deletePasskey';
import type { DeleteScheduleEntryDefinition } from '@app/api/admin/event/schedule/deleteScheduleEntry';
import type { DisplayDefinition } from '@app/api/display/route';
import type { ErrorDefinition } from '@app/api/error/route';
import type { ExportsDefinition } from '@app/api/exports/route';
import type { GeneratePromptDefinition } from '@app/api/ai/generatePrompt';
import type { GetScheduleDefinition } from '@app/api/admin/event/schedule/getSchedule';
import type { HelpRequestDefinition } from '@app/api/display/help-request/route';
import type { HotelsDefinition } from '@app/api/event/hotels/[event]/route';
import type { ListPasskeysDefinition } from '@app/api/auth/passkeys/listPasskeys';
import type { PasswordChangeDefinition } from '@app/api/auth/passwordChange';
import type { PasswordResetDefinition } from '@app/api/auth/passwordReset';
import type { PasswordResetRequestDefinition } from '@app/api/auth/passwordResetRequest';
import type { PasswordResetVerifyDefinition } from '@app/api/auth/passwordResetVerify';
import type { RegisterActivateDefinition } from '@app/api/auth/registerActivate';
import type { RegisterDefinition } from '@app/api/auth/register';
import type { RegisterPasskeyDefinition } from '@app/api/auth/passkeys/registerPasskey';
import type { RemindParticipationDefinition } from '@app/api/admin/retention/remindParticipation';
import type { ScheduleTaskDefinition } from '@app/api/admin/scheduler/scheduleTask';
import type { ServiceHealthDefinition } from '@app/api/admin/serviceHealth';
import type { SettingsDefinition } from '@app/api/auth/settings';
import type { SignInPasskeyDefinition } from '@app/api/auth/signInPasskey';
import type { SignInPasswordDefinition } from '@app/api/auth/signInPassword';
import type { SignInPasswordUpdateDefinition } from '@app/api/auth/signInPasswordUpdate';
import type { SignOutDefinition } from '@app/api/auth/signOut';
import type { SubmitFeedbackDefinition } from '@app/api/event/schedule/submitFeedback';
import type { TrainingsDefinition } from '@app/api/event/trainings/[event]/route';
import type { UpdateAccountDefinition } from '@app/api/auth/updateAccount';
import type { UpdateAiSettingsDefinition } from '@app/api/ai/updateSettings';
import type { UpdateApplicationDefinition } from '@app/api/application/updateApplication';
import type { UpdateAvatarDefinition } from '@app/api/auth/updateAvatar';
import type { UpdateEventDefinition } from '@app/api/admin/updateEvent';
import type { UpdateFavouriteDefinition } from '@app/api/event/schedule/updateFavourite';
import type { UpdateHelpRequestDefinition } from '@app/api/event/schedule/updateHelpRequest';
import type { UpdateIntegrationDefinition } from '@app/api/admin/updateIntegration';
import type { UpdateNotesDefinition } from '@app/api/event/schedule/updateNotes';
import type { UpdateScheduleEntryDefinition } from '@app/api/admin/event/schedule/updateScheduleEntry';
import type { UpdateSettingsDefinition } from '@app/api/admin/updateSettings';
import type { UpdateVendorScheduleDefinition } from '@app/api/admin/vendors/updateVendorSchedule';
import type { VertexAiDefinition } from '@app/api/admin/vertexAi';
import type { VolunteerContactInfoDefinition } from '@app/api/admin/volunteerContactInfo';
import type { VolunteerRolesDefinition } from '@app/api/admin/volunteerRoles';
import type { VolunteerTeamsDefinition } from '@app/api/admin/volunteerTeams';

import type { ContentCategoriesEndpoints } from '@app/api/admin/content/categories/[[...id]]/route';
import type { ContentEndpoints } from '@app/api/admin/content/[[...id]]/route';
import type { DisplayRequestsEndpoints } from '@app/api/admin/organisation/displays/requests/route';
import type { DisplaysEndpoints } from '@app/api/admin/organisation/displays/[[...id]]/route';
import type { EventDatesEndpoints } from '@app/api/admin/event/dates/[[...id]]/route';
import type { EventFinanceEndpoints } from '@app/api/admin/event/finance/[[...id]]/route';
import type { EventScheduleHistoryEndpoints } from '@app/api/admin/event/schedule/history/[[...id]]/route';
import type { EventShiftCategoriesEndpoints } from '@app/api/admin/event/shifts/categories/[[...id]]/route';
import type { EventShiftEndpoints } from '@app/api/admin/event/shifts/[[...id]]/route';
import type { EventTeamEndpoints } from '@app/api/admin/event/teams/[[...id]]/route';
import type { ExportsEndpoints } from '@app/api/admin/exports/[[...id]]/route';
import type { FeedbackEndpoints } from '@app/api/admin/organisation/feedback/route';
import type { HotelsAssignmentsEndpoints } from '@app/api/admin/hotels/assignments/[[...id]]/route';
import type { HotelsEndpoints } from '@app/api/admin/hotels/[[...id]]/route';
import type { LogsEndpoints } from '@app/api/admin/logs/[[...id]]/route';
import type { NardoEndpoints } from '@app/api/nardo/[[...id]]/route';
import type { NardoPersonalisedEndpoints } from '@app/api/nardo/personalised/[[...id]]/route';
import type { OutboxEmailEndpoints } from '@app/api/admin/outbox/email/[[...id]]/route';
import type { OutboxTwilioEndpoints } from '@app/api/admin/outbox/twilio/route';
import type { ProgramActivitiesEndpoints } from '@app/api/admin/program/activities/[[...id]]/route';
import type { ProgramAreasEndpoints } from '@app/api/admin/program/areas/[[...id]]/route';
import type { ProgramChangesEndpoints } from '@app/api/admin/program/changes/route';
import type { ProgramLocationsEndpoints } from '@app/api/admin/program/locations/[[...id]]/route';
import type { ProgramRequestEndpoints } from '@app/api/admin/program/requests/[[...id]]/route';
import type { RefundRequestEndpoints } from '@app/api/admin/refunds/[[...id]]/route';
import type { RetentionEndpoints } from '@app/api/admin/retention/[[...id]]/route';
import type { RolesEndpoints } from '@app/api/admin/organisation/roles/[[...id]]/route';
import type { SchedulerEndpoints } from '@app/api/admin/scheduler/[[...id]]/route';
import type { SubscriptionsEndpoints } from '@app/api/admin/subscriptions/[[...id]]/route';
import type { TrainingsAssignmentsEndpoints } from '@app/api/admin/trainings/assignments/[[...id]]/route';
import type { TrainingsEndpoints } from '@app/api/admin/trainings/[[...id]]/route';
import type { TrainingsExtraEndpoints } from '@app/api/admin/trainings/extra/[[...id]]/route';
import type { VendorEndpoints } from '@app/api/admin/vendors/[[...id]]/route';
import type { WebhookEndpoints } from '@app/api/admin/webhooks/route';

/**
 * Type helpers for deciding on the request and response types for API definitions. Because they are
 * generic zod objects without a base class, we infer typing rather than define it.
 */
type ApiRequestType<T> = T extends { request: object } ? T['request'] : never;
type ApiResponseType<T> = T extends { response: object } ? T['response'] : void;

/**
 * Mapping of the API endpoints that are available, with the request method and type information
 * associated with that. This enables significant simplication of the `callApi` method.
 */
export type ApiEndpoints = {
    'get': {
        '/api/admin/content/categories': ContentCategoriesEndpoints['list'],
        '/api/admin/content': ContentEndpoints['list'],
        '/api/admin/content/:id': ContentEndpoints['get'],
        '/api/admin/event/dates': EventDatesEndpoints['list'],
        '/api/admin/event/finance': EventFinanceEndpoints['list'],
        '/api/admin/event/schedule/history': EventScheduleHistoryEndpoints['list'],
        '/api/admin/event/schedule/:event/:team': GetScheduleDefinition,
        '/api/admin/event/shifts/categories': EventShiftCategoriesEndpoints['list'],
        '/api/admin/event/shifts': EventShiftEndpoints['list'],
        '/api/admin/event/teams': EventTeamEndpoints['list'],
        '/api/admin/exports': ExportsEndpoints['list'],
        '/api/admin/hotels/assignments': HotelsAssignmentsEndpoints['list'],
        '/api/admin/hotels': HotelsEndpoints['list'],
        '/api/admin/logs': LogsEndpoints['list'],
        '/api/admin/organisation/displays': DisplaysEndpoints['list'],
        '/api/admin/organisation/displays/requests': DisplayRequestsEndpoints['list'],
        '/api/admin/organisation/feedback': FeedbackEndpoints['list'],
        '/api/admin/organisation/roles': RolesEndpoints['list'],
        '/api/admin/outbox/email': OutboxEmailEndpoints['list'],
        '/api/admin/outbox/email/:id': OutboxEmailEndpoints['get'],
        '/api/admin/outbox/twilio': OutboxTwilioEndpoints['list'],
        '/api/admin/program/activities': ProgramActivitiesEndpoints['list'],
        '/api/admin/program/areas': ProgramAreasEndpoints['list'],
        '/api/admin/program/changes': ProgramChangesEndpoints['list'],
        '/api/admin/program/locations': ProgramLocationsEndpoints['list'],
        '/api/admin/program/requests': ProgramRequestEndpoints['list'],
        '/api/admin/refunds': RefundRequestEndpoints['list'],
        '/api/admin/retention': RetentionEndpoints['list'],
        '/api/admin/scheduler': SchedulerEndpoints['list'],
        '/api/admin/scheduler/:id': SchedulerEndpoints['get'],
        '/api/admin/subscriptions': SubscriptionsEndpoints['list'],
        '/api/admin/trainings': TrainingsEndpoints['list'],
        '/api/admin/trainings/assignments': TrainingsAssignmentsEndpoints['list'],
        '/api/admin/trainings/extra': TrainingsExtraEndpoints['list'],
        '/api/admin/vendors': VendorEndpoints['list'],
        '/api/admin/webhooks': WebhookEndpoints['list'],
        '/api/auth/passkeys/list': ListPasskeysDefinition,
        '/api/event/hotels/:event': HotelsDefinition,
        '/api/event/trainings/:event': TrainingsDefinition,
        '/api/display': DisplayDefinition,
        '/api/nardo': NardoEndpoints['list'],
        '/api/nardo/personalised': NardoPersonalisedEndpoints['list'],
    },
    'post': {
        '/api/admin/content/categories': ContentCategoriesEndpoints['create'],
        '/api/admin/content': ContentEndpoints['create'],
        '/api/admin/create-event': CreateEventDefinition,
        '/api/admin/event/dates': EventDatesEndpoints['create'],
        '/api/admin/event/schedule/:event/:team': CreateScheduleEntryDefinition,
        '/api/admin/event/shifts/categories': EventShiftCategoriesEndpoints['create'],
        '/api/admin/event/shifts': EventShiftEndpoints['create'],
        '/api/admin/hotels/assignments': HotelsAssignmentsEndpoints['create'],
        '/api/admin/hotels': HotelsEndpoints['create'],
        '/api/admin/organisation/roles': RolesEndpoints['create'],
        '/api/admin/program/activities': ProgramActivitiesEndpoints['create'],
        '/api/admin/program/areas': ProgramAreasEndpoints['create'],
        '/api/admin/program/locations': ProgramLocationsEndpoints['create'],
        '/api/admin/retention': RemindParticipationDefinition,
        '/api/admin/scheduler': ScheduleTaskDefinition,
        '/api/admin/service-health': ServiceHealthDefinition,
        '/api/admin/trainings': TrainingsEndpoints['create'],
        '/api/admin/trainings/extra': TrainingsExtraEndpoints['create'],
        '/api/admin/update-event': UpdateEventDefinition,
        '/api/admin/update-integration': UpdateIntegrationDefinition,
        '/api/admin/update-settings': UpdateSettingsDefinition,
        '/api/admin/vendors': VendorEndpoints['create'],
        '/api/admin/vertex-ai': VertexAiDefinition,
        '/api/admin/volunteer-contact-info': VolunteerContactInfoDefinition,
        '/api/admin/volunteer-roles': VolunteerRolesDefinition,
        '/api/admin/volunteer-teams': VolunteerTeamsDefinition,
        '/api/ai/generate/:type': GeneratePromptDefinition,
        '/api/auth/confirm-identity': ConfirmIdentityDefinition,
        '/api/auth/passkeys/create-challenge': CreateChallengeDefinition,
        '/api/auth/passkeys/register': RegisterPasskeyDefinition,
        '/api/auth/password-change': PasswordChangeDefinition,
        '/api/auth/password-reset-request': PasswordResetRequestDefinition,
        '/api/auth/password-reset-verify': PasswordResetVerifyDefinition,
        '/api/auth/password-reset': PasswordResetDefinition,
        '/api/auth/register-activate': RegisterActivateDefinition,
        '/api/auth/register': RegisterDefinition,
        '/api/auth/settings': SettingsDefinition,
        '/api/auth/sign-in-passkey': SignInPasskeyDefinition,
        '/api/auth/sign-in-password': SignInPasswordDefinition,
        '/api/auth/sign-in-password-update': SignInPasswordUpdateDefinition,
        '/api/auth/sign-out': SignOutDefinition,
        '/api/auth/update-account': UpdateAccountDefinition,
        '/api/auth/update-avatar': UpdateAvatarDefinition,
        '/api/display/help-request': HelpRequestDefinition,
        '/api/error': ErrorDefinition,
        '/api/event/schedule/feedback': SubmitFeedbackDefinition,
        '/api/exports': ExportsDefinition,
        '/api/nardo': NardoEndpoints['create'],
        '/api/nardo/personalised': NardoPersonalisedEndpoints['create'],
    },
    'delete': {
        '/api/admin/content/categories/:id': ContentCategoriesEndpoints['delete'],
        '/api/admin/content/:id': ContentEndpoints['delete'],
        '/api/admin/event/dates/:id': EventDatesEndpoints['delete'],
        '/api/admin/event/schedule/history/:id': EventScheduleHistoryEndpoints['delete'],
        '/api/admin/event/schedule/:event/:team/:id': DeleteScheduleEntryDefinition,
        '/api/admin/event/shifts/categories/:id': EventShiftCategoriesEndpoints['delete'],
        '/api/admin/event/shifts/:id': EventShiftEndpoints['delete'],
        '/api/admin/hotels/assignments/:id': HotelsAssignmentsEndpoints['delete'],
        '/api/admin/hotels/:id': HotelsEndpoints['delete'],
        '/api/admin/logs/:id': LogsEndpoints['delete'],
        '/api/admin/organisation/displays/:id': DisplaysEndpoints['delete'],
        '/api/admin/program/activities/:id': ProgramActivitiesEndpoints['delete'],
        '/api/admin/program/areas/:id': ProgramAreasEndpoints['delete'],
        '/api/admin/program/locations/:id': ProgramLocationsEndpoints['delete'],
        '/api/admin/trainings/:id': TrainingsEndpoints['delete'],
        '/api/admin/trainings/extra/:id': TrainingsExtraEndpoints['delete'],
        '/api/admin/vendors/:id': VendorEndpoints['delete'],
        '/api/auth/passkeys/delete': DeletePasskeyDefinition,
        '/api/nardo/:id': NardoEndpoints['delete'],
    },
    'put': {
        '/api/admin/content/categories/:id': ContentCategoriesEndpoints['update'],
        '/api/admin/content/:id': ContentEndpoints['update'],
        '/api/admin/event/dates/:id': EventDatesEndpoints['update'],
        '/api/admin/event/finance/:id': EventFinanceEndpoints['update'],
        '/api/admin/event/schedule/:event/:team/:id': UpdateScheduleEntryDefinition,
        '/api/admin/event/shifts/categories/:id': EventShiftCategoriesEndpoints['update'],
        '/api/admin/event/shifts/:id': EventShiftEndpoints['update'],
        '/api/admin/event/teams/:id': EventTeamEndpoints['update'],
        '/api/admin/hotels/assignments/:id': HotelsAssignmentsEndpoints['update'],
        '/api/admin/hotels/:id': HotelsEndpoints['update'],
        '/api/admin/organisation/displays/:id': DisplaysEndpoints['update'],
        '/api/admin/organisation/roles/:id': RolesEndpoints['update'],
        '/api/admin/program/activities/:id': ProgramActivitiesEndpoints['list'],
        '/api/admin/program/areas/:id': ProgramAreasEndpoints['update'],
        '/api/admin/program/locations/:id': ProgramLocationsEndpoints['update'],
        '/api/admin/program/requests/:id': ProgramRequestEndpoints['update'],
        '/api/admin/refunds/:id': RefundRequestEndpoints['update'],
        '/api/admin/retention/:id': RetentionEndpoints['update'],
        '/api/admin/subscriptions/:id': SubscriptionsEndpoints['update'],
        '/api/admin/trainings/:id': TrainingsEndpoints['update'],
        '/api/admin/trainings/assignments/:id': TrainingsAssignmentsEndpoints['update'],
        '/api/admin/trainings/extra/:id': TrainingsExtraEndpoints['update'],
        '/api/admin/vendors/schedule': UpdateVendorScheduleDefinition,
        '/api/admin/vendors/:id': VendorEndpoints['update'],
        '/api/ai/settings': UpdateAiSettingsDefinition,
        '/api/application/:event/:team/:userId': UpdateApplicationDefinition,
        '/api/event/schedule/favourite': UpdateFavouriteDefinition,
        '/api/event/schedule/help-request': UpdateHelpRequestDefinition,
        '/api/event/schedule/notes': UpdateNotesDefinition,
        '/api/nardo/:id': NardoEndpoints['update'],
    },
};

/**
 * The `fetch` function that should be used by the `callApi` machinery. Can be overridden for tests.
 */
let globalFetch = globalThis.fetch;

/**
 * Writes the `value` at the given `path` to the `searchParams`. This allows the `callApi()` method
 * to support input parameters to GET requests seamlessly.
 */
function writeToSearchParams(searchParams: URLSearchParams, value: any, path: string[]) {
    if (Array.isArray(value))
        throw new Error('Support for arrays has not been implemented yet');

    if (typeof value === 'object') {
        for (const [ childKey, childValue ] of Object.entries(value))
            writeToSearchParams(searchParams, childValue, [ ...path, childKey ]);

        return;
    }

    if (typeof value === 'undefined')
        return;

    searchParams.set(path.join('.'), `${value}`);
}

/**
 * The `callApi` method is the Volunteer Manager's canonical mechanism for making REST API calls. It
 * is automatically typed based on predefined mappings for both request and response parameters. The
 * function will throw an error when a network error occurs, or an API call cannot be completed for
 * other reasons. (Including server errors.)
 *
 * @example
 * ```
 * callApi('get', '/api/event/hotel', { eventSlug: '2024' });
 * callApi('delete', '/api/admin/content/:id', { id: 42, scope: { ... } });
 * ```
 */
export async function callApi<Method extends keyof ApiEndpoints,
                              Endpoint extends keyof ApiEndpoints[Method] & string>(
    method: Method,
    endpoint: Endpoint,
    request: ApiRequestType<ApiEndpoints[Method][Endpoint]>)
        : Promise<ApiResponseType<ApiEndpoints[Method][Endpoint]>>
{
    // (1) Replace placeholders in the endpoint with members included in the request.
    const consumedProperties = new Set<string>();
    const completedEndpoint = endpoint.replace(/:(\w+)/g, (_, placeholder) => {
        if (!Object.hasOwn(request, placeholder))
            throw new Error(`Endpoint placeholder doesn't exist in the request: ":${placeholder}"`);

        consumedProperties.add(placeholder);

        const value = (request as any)[placeholder];
        switch (typeof value) {
            case 'number':
            case 'string':
                return `${value}`;

            default:
                throw new Error(`Endpoint placeholders must be scalars (found ${typeof value})`);
        }
    });

    // (2) Remove the `consumedProperties` from the `request` object, to not transmit them twice.
    for (const consumedProperty of consumedProperties)
        delete (request as any)[consumedProperty];

    // (3) Compose the actual request endpoint, headers and payload.
    let requestEndpoint: string = completedEndpoint;
    let requestHeaders: Record<string, string> | undefined;
    let requestPayload: string | undefined;

    if (method === 'get') {
        const searchParams = new URLSearchParams();
        writeToSearchParams(searchParams, request, [ /* empty path */ ]);
        requestEndpoint += `?${searchParams.toString()}`;
    } else {
        requestHeaders = { 'Content-Type': 'application/json' };
        requestPayload = JSON.stringify(request);
    }

    // (4) Issue the request to the server with the composed information.
    const response = await globalFetch(requestEndpoint, {
        method: method.toUpperCase(),
        headers: requestHeaders,
        body: requestPayload,
    });

    if (!response.ok)
        throw new Error(`The server responded with HTTP ${response.status} status code.`);

    return await response.json();
}

/**
 * Injects the given `fetch` function to the `callApi` infrastructure. When a value is given, that
 * function will be called instead of the real `fetch`. Without a value, state will be reset.
 */
export function injectFetch(fetch?: typeof globalThis.fetch): void {
    globalFetch = fetch ?? globalThis.fetch;
}
