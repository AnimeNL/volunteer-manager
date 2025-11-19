// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type LogEntry, type LogSeverity, type LogType, kLogSeverity, kLogType } from './Log';
import db, { tLogs, tUsers } from './database';

/**
 * Interface that defines the format for log messages as it can be presented in the user interface.
 */
export interface LogMessage {
    /**
     * Arbitrary data that was included with the log message.
     */
    data?: any;

    /**
     * Date at which the log message was stored in the database, in UTC formatted in a Temporal
     * ZonedDateTime-compatible format.
     */
    date: string;

    /**
     * Unique ID of this log entry. No need to show this to the user.
     */
    id: number;

    /**
     * Type of log that's been issued. This will be used to determine the message that should be.
     * Deliberately not typed according to `LogType` as old entries may be included.
     */
    type: string;

    /**
     * Textual representation of what happened during this log message.
     */
    message: string;

    /**
     * Severity of the log message as it was issued.
     */
    severity: LogSeverity;

    /**
     * Source of the person or entity who issued the log message, if any.
     */
    source?: { userId: number; name: string };

    /**
     * Target of the person of entity about who the log message was issued, if any.
     */
    target?: { userId: number; name: string };
}

/**
 * Enumeration containing log types that have been deprecated. We still want to be able to display
 * the origin log messages in a formatted manner, but autocomplete doesn't have to care.
 */
const kDeprecatedLogType = {
    AdminEventDeadlineMutation: 'admin-event-deadline-mutation',
    AdminHotelBookingCreate: 'admin-hotel-booking-create',
    AdminHotelBookingDelete: 'admin-hotel-booking-delete',
    AdminHotelBookingUpdate: 'admin-hotel-booking-update',
    AdminUpdateAnimeConIntegration: 'admin-update-animecon-integration',
    AdminUpdateEmailIntegration: 'admin-update-email-integration',
    AdminUpdateGoogleIntegration: 'admin-update-google-integration',
    AdminUpdatePromptIntegration: 'admin-update-prompt-integration',
    AdminUpdateVertexIntegration: 'admin-update-vertex-integration',
    AdminWhatsAppMutation: 'admin-whatsapp-mutation',
} as const;

/**
 * Enumeration containing log types that have been deprecated. We still want to be able to display
 * the origin log messages in a formatted manner, but autocomplete doesn't have to care.
 */
type DeprecatedLogType = typeof kDeprecatedLogType[keyof typeof kDeprecatedLogType];

/**
 * Signature of log message formatting functions that can be used in the table below.
 */
type LogMessageFormatFn =
    (source: LogMessage['source'], target: LogMessage['target'], data: LogMessage['data'])
        => string;

/**
 * Formatting rules for each of the log message types. Strings with a series of special placeholders
 * may be used, alternatively a function may be used for more advanced processing.
 */
const kLogMessageFormatter: {
    [ key in (DeprecatedLogType | LogType) ]: string | LogMessageFormatFn
} = {
    [kLogType.AccountActivate]: 'Activated their account',
    [kLogType.AccountIdentifyAccessCode]: 'Signed in using an access code',
    [kLogType.AccountIdentifyPasskey]: 'Signed in using a passkey',
    [kLogType.AccountIdentifyPassword]: 'Signed in using a password',
    [kLogType.AccountIdentityCheck]: (source, target, { username }) => {
        return `Confirmed existence of an account (${username})`;
    },
    [kLogType.AccountPasskeyCreate]: 'Created a passkey for their account',
    [kLogType.AccountPasskeyDelete]: 'Deleted a passkey from their account',
    [kLogType.AccountPasswordResetRequest]: 'Requested their password to be reset',
    [kLogType.AccountPasswordReset]: 'Reset their password and signed in',
    [kLogType.AccountPasswordUpdate]: 'Updated their password',
    [kLogType.AccountRegister]: 'Created their account',
    [kLogType.AccountUpdateAvatar]: 'Uploaded a new avatar',
    [kLogType.AccountUpdate]: 'Updated their account information',
    [kLogType.AdminAccessVolunteerInfo]: (source, target) => {
        return `Accessed contact information for ${target?.name}`;
    },
    [kLogType.AdminAnonymizeAccount]: (source, target) => {
        return `Anonymized account #${target?.userId}`;
    },
    [kLogType.AdminClearHotelPreferences]: (source, target, { event }) => {
        return `Cleared ${target?.name}'s hotel preferences for ${event}`;
    },
    [kLogType.AdminClearRefundRequest]: (source, target, { event }) => {
        return `Cleared ${target?.name}'s refund request for ${event}`;
    },
    [kLogType.AdminClearTrainingPreferences]: (source, target, { event }) => {
        return `Cleared ${target?.name}'s training preferences for ${event}`;
    },
    [kLogType.AdminContentMutation]: (source, target, { mutation, context }) => {
        return `${mutation} page ${context}`;
    },
    [kLogType.AdminDeleteAvatar]: (source, target) => {
        return `Deleted an avatar from ${target?.name}'s account`;
    },
    [kLogType.AdminEnvironmentCreate]: (source, target, { domain }) => {
        return `Created a new environment for ${domain}`;
    },
    [kLogType.AdminEnvironmentDelete]: (source, target, { domain }) => {
        return `Removed the environment for ${domain}`;
    },
    [kLogType.AdminCreateRole]: 'Created a new volunteering role',
    [kLogType.AdminDisplayMutation]: (source, target, { mutation, identifier, label }) => {
        return `${mutation} the "${identifier}" physical display` + (!!label ? ` (${label})` : '');
    },
    [kLogType.AdminEventApplication]: (source, target, { event }) => {
        return `Applied for ${target?.name} to participate in ${event}`;
    },
    [kLogType.AdminEventApplicationMove]: (source, target, { team }) => {
        return `Moved their application to the ${team} team`;
    },
    [kLogType.AdminEventCreate]: (source, target, { event }) => `Created the ${event} event`,
    [kLogType.AdminEventDateMutation]: (source, target, { event, mutation }) => {
        return `${mutation} a special date for ${event}`;
    },
    [kLogType.AdminEventHotelMutation]: (source, target, { eventName, mutation }) => {
        return `${mutation} an hotel room for ${eventName}`;
    },
    [kLogType.AdminEventProgramRequestUpdate]: (source, target, { activity, event }) => {
        return `Updated the "${activity}" program request for ${event}`;
    },
    [kLogType.AdminEventPublishInfo]: (source, target, { event, published, type }) => {
        return `${published ? 'Published' : 'Unpublished'} ${type} information for ${event}`;
    },
    [kLogType.AdminEventRetentionMessage]: (source, target, { channel, event }) => {
        return `Reached out to ${target?.name} using ${channel} regarding ${event}`;
    },
    [kLogType.AdminEventRetentionUpdate]: (source, target, { event }) => {
        return `Updated ${event} retention for ${target?.name}`;
    },
    [kLogType.AdminEventRoleUpdate]: (source, target, { role }) => {
        return `Updated their role to ${role} for an event`;
    },
    [kLogType.AdminEventShiftCategoryMutation]: (source, target, { category, mutation }) => {
        return `${mutation} the "${category}" shift category`;
    },
    [kLogType.AdminEventShiftMutation]: (source, target, { event, mutation, shift, team }) => {
        return `${mutation} the "${shift}" ${team} shift for ${event}`;
    },
    [kLogType.AdminEventTeamUpdate]: (source, target, { sourceTeam, targetTeam }) => {
        return `Moved ${target?.name} from the ${sourceTeam} to the ${targetTeam}`;
    },
    [kLogType.AdminEventTrainingAssignment]: (source, target, { eventName }) => {
        return target ? `Updated ${target.name}'s training assignment for ${eventName}`
                      : `Updated a training assignment for ${eventName}`;
    },
    [kLogType.AdminEventTrainingMutation]: (source, target, { eventName, mutation }) => {
        return `${mutation} a training session for ${eventName}`;
    },
    [kLogType.AdminEventTrainingExtraMutation]: (source, target, { eventName, mutation }) => {
        return `${mutation} an extra participant to ${eventName} trainings`;
    },

    [kLogType.AdminExportMutation]: (source, target, { eventName, type, mutation }) => {
        return `${mutation} a ${type.replace(/s$/, '').toLowerCase()} data export for ${eventName}`;
    },

    [kLogType.AdminFeedbackResponse]: (source, target) => {
        return `Responded to feedback received from ${target?.name}`;
    },

    [kLogType.AdminHotelAssignVolunteer]: (source, target, { event }) => {
        return `Assigned ${target?.name} to a hotel room for ${event}`;
    },
    [kLogType.AdminHotelAssignVolunteerDelete]: (source, target, { event }) => {
        return `Removed ${target?.name}'s hotel room for ${event}`;
    },
    [kLogType.AdminHotelBookingMutation]: (source, target, { event, mutation }) => {
        return `${mutation} an hotel assignment for ${event}`;
    },
    [kLogType.AdminImpersonateVolunteer]: (source, target, data) => {
        return `Impersonated ${target?.name}'s account`;
    },
    [kLogType.AdminKnowledgeBaseCategoryMutation]: (_, __, { mutation, event, category }) => {
        return `${mutation} the "${category}" knowledge base category for ${event}`;
    },
    [kLogType.AdminKnowledgeBaseMutation]: (source, target, { mutation, event, question }) => {
        return `${mutation} the "${question}" question for ${event}`;
    },

    [kLogType.AdminNardoMutation]: (source, target, { mutation }) => {
        return `${mutation} an excellent piece of Del a Rie Advies`;
    },

    [kLogType.AdminProgramMutation]: (source, target, { event, entityType, entity, mutation }) => {
        return `${mutation} the "${entity}" ${entityType} for ${event}`;
    },

    [kLogType.AdminRefundMutation]: (source, target, { event }) => {
        return `Updated ${target?.name}'s refund status for ${event}`;
    },

    [kLogType.AdminResetAccessCode]: (source, target, data) => {
        return `Created a new access code for ${target?.name}`;
    },
    [kLogType.AdminResetPasswordLink]: (source, target, data) => {
        return `Created a new password reset link for ${target?.name}`;
    },
    [kLogType.AdminSubscriptionUpdate]: (source, target) => {
        return `Updated the subscriptions for ${target?.name}`;
    },
    [kLogType.AdminSuspendVolunteer]: (source, target, { action }) => {
        return `${action} ${target?.name}'s account`;
    },
    [kLogType.AdminTeamCreate]: (source, target, { title }) => {
        return `Created the ${title} team`;
    },
    [kLogType.AdminTeamEnable]: (source, target, { action, team }) => {
        return `${action} the ${team} team`;
    },
    [kLogType.AdminTeamResetKey]: (source, target, { team }) => {
        return `Reset the key of the ${team} team`;
    },
    [kLogType.AdminUpdateActivation]: (source, target, data) => {
        return data.activated ? `Activated the account of ${target?.name}`
                              : `Deactivated their account of ${target?.name}`;
    },
    [kLogType.AdminUpdateAiSetting]: (source, target, { setting }) => {
        return `Updated the generative AI ${setting}`;
    },
    [kLogType.AdminUpdateAvailabilityPreferences]: (source, target, { event }) => {
        return `Updated their availability preferences for ${event}`;
    },
    [kLogType.AdminUpdateEvent]: (source, target, { action, event }) => {
        return `Updated ${action ?? 'settings'} for ${event}`;
    },
    [kLogType.AdminUpdateAvatar]: (source, target) => `Updated ${target?.name}'s avatar`,
    [kLogType.AdminUpdateEnvironment]: 'Updated Volunteer Manager environment configuration',
    [kLogType.AdminUpdateHotelPreferences]: (source, target, { event }) => {
        return `Updated their hotel preferences for ${event}`;
    },
    [kLogType.AdminUpdateIntegration]: (source, target, { integration }) => {
        return `Updated the ${integration} integration settings`;
    },
    [kLogType.AdminUpdatePermission]: (source, target, data) => {
        return `Updated the permissions of ${target?.name}`;
    },
    [kLogType.AdminUpdateRefundRequest]: (source, target, { event }) => {
        return `Updated ticket refund settings for ${target?.name} during ${event}`;
    },
    [kLogType.AdminUpdateRole]: (source, target, { role }) => `Updated the ${role} role settings`,
    [kLogType.AdminUpdateSettings]: 'Updated the Volunteer Manager settings',
    [kLogType.AdminUpdateTeam]: (source, target, { team }) => `Updated the ${team} team settings`,
    [kLogType.AdminUpdateTrainingPreferences]: (source, target, { event }) => {
        return `Updated their training preferences for ${event}`;
    },
    [kLogType.AdminUpdateVolunteer]: (source, target, data) => {
        return `Updated the user information of ${target?.name}`;
    },
    [kLogType.AdminVendorMutation]: (source, target, { event, mutation, team }) => {
        return `${mutation} a ${team} vendor for ${event}`;
    },
    [kLogType.AdminVendorScheduleUpdate]: (start, target, { event, team }) => {
        return `Updated the ${team} schedule for ${event}`;
    },
    [kLogType.AdminVerifyDiscord]: (source, target) => {
        return `Verified the Discord account of ${target?.name}`;
    },
    [kLogType.AdminUpdateTeamVolunteer]: (source, target, data) => {
        return `Updated event preferences for ${target?.name}`;
    },
    [kLogType.AdminUpdateTeamVolunteerStatus]: (source, target, { action, event }) => {
        return `${action} ${target?.name}'s participation in ${event}`;
    },
    [kLogType.ApplicationAvailabilityPreferences]: (source, target, { event }) => {
        return `Updated their availability preferences for ${event}`;
    },
    [kLogType.ApplicationHotelPreferences]: (source, target, { event }) => {
        return `Updated their hotel preferences for ${event}`;
    },
    [kLogType.ApplicationRefundRequest]: (source, target, { event }) => {
        return `Requested a refund for their ${event} ticket`;
    },
    [kLogType.ApplicationTrainingPreferences]: (source, target, { event }) => {
        return `Updated their training preferences for ${event}`;
    },

    [kLogType.DatabaseError]: (source, target, { query }) => {
        const normalizedQuery = query.trim().replace(/\s{2,}/g, ' ').substring(0, 32);
        return `Database error: "${normalizedQuery}"…`;
    },

    [kLogType.EventApplication]: (source, target, { event }) =>
        `Applied to participate in ${event}`,
    [kLogType.EventFeedbackSubmitted]: 'Submitted feedback through the Volunteer Portal',
    [kLogType.EventHelpRequestUpdate]: (source, target, { event, display, mutation }) => {
        return `${mutation} a help request from ${display} for ${event}`;
    },
    [kLogType.EventVolunteerNotes]: (source, target, { event }) => {
        return `Updated notes for ${target?.name} during ${event}`;
    },

    [kLogType.ExportDataAccess]: (source, target, { event, type }) => {
        return `Accessed exported ${event} ${type} data`;
    },
    [kLogType.NardoPersonalisedAdvice]: 'Requested personalised advice from Del a Rie Advies',

    // ---------------------------------------------------------------------------------------------
    // Deprecated
    // ---------------------------------------------------------------------------------------------

    [kDeprecatedLogType.AdminEventDeadlineMutation]: (source, target, { event, mutation }) => {
        return `${mutation} a deadline for ${event}`;
    },
    [kDeprecatedLogType.AdminHotelBookingCreate]: (source, target, { event }) => {
        return `Created a new hotel assignment for ${event}`;
    },
    [kDeprecatedLogType.AdminHotelBookingDelete]: (source, target, { event }) => {
        return `Deleted a hotel assignment for ${event}`;
    },
    [kDeprecatedLogType.AdminHotelBookingUpdate]: (source, target, { event }) => {
        return `Updated a hotel assignment for ${event}`;
    },
    [kDeprecatedLogType.AdminUpdateAnimeConIntegration]:
        'Updated the integration settings for AnimeCon',
    [kDeprecatedLogType.AdminUpdateEmailIntegration]: 'Updated the e-mail integration settings',
    [kDeprecatedLogType.AdminUpdateGoogleIntegration]:
        'Updated the integration settings for Google',
    [kDeprecatedLogType.AdminUpdatePromptIntegration]: 'Updated the Vertex AI LLM prompts',
    [kDeprecatedLogType.AdminUpdateVertexIntegration]:
        'Updated the integration settings for Vertex AI',
    [kDeprecatedLogType.AdminWhatsAppMutation]: (source, target, { mutation }) => {
        return `${mutation} a WhatsApp notification recipient`;
    },
};

/**
 * Sort model to apply for the returned log items.
 */
interface FetchLogsSort {
    field: 'id' | 'data' | 'date' | 'message' | 'severity' | 'source' | 'target' | 'type';
    sort: 'asc' | 'desc' | null;
}

/**
 * Parameters that can be passed to the fetchLogs() function.
 */
interface FetchLogsParams {
    /**
     * Message severity to consider. Defaults to [Info, Warning, Error].
     */
    severity?: Exclude<LogEntry['severity'], null | undefined>[];

    /**
     * The User ID who was either the source or the target of the log message.
     */
    sourceOrTargetUserId?: number;

    /**
     * Sort model to apply for the returned log items. Defaults to date, in descending order.
     */
    sort?: FetchLogsSort;

    /**
     * Pagination that should be applied to the logs data request.
     */
    pagination?: {
        page: number;
        pageSize: number;
    },
}

/**
 * The response that a call to fetchLogs() can expect.
 */
interface FetchLogsResponse {
    /**
     * Total number of log messages that could be fetched, ignoring limitations.
     */
    messageCount: number;

    /**
     * All messages that were returned from the query.
     */
    messages: LogMessage[];
}

/**
 * Normalizes the sort model based on the request's input, to something that the database is able to
 * deal with. The sort model will be applied in the query.
 */
function normalizeSortModel(sortModel?: FetchLogsSort): string {
    const { field, sort } = sortModel ?? { field: 'date', sort: 'asc' };

    let column: string;
    switch (field) {
        case 'id':
        case 'data':
        case 'date':
        case 'severity':
            column = field;
            break;

        case 'source':
            column = 'sourceUserName';
            break;

        case 'target':
            column = 'targetUserName';
            break;

        case 'type':
            column = 'logType';
            break;

        default:
            throw new Error(`Unrecognised field: ${field}`);
    }

    let order: string;
    switch (sort) {
        case 'asc':
        case 'desc':
        case undefined:
            order = sort ?? 'asc';
            break;

        case null:
            order = 'asc nulls last';
            break;

        default:
            throw new Error(`Unrecognised sort order: ${sort}`);
    }

    return `${column} ${order}`;
}

/**
 * Fetches and formats log messages from the database in accordance with the `params`. Defaults will
 * apply where applicable. Returns zero or more messages.
 */
export async function fetchLogs(params: FetchLogsParams): Promise<FetchLogsResponse> {
    const sourceUserJoin = tUsers.forUseInLeftJoinAs('source');
    const targetUserJoin = tUsers.forUseInLeftJoinAs('target');

    const dbInstance = db;
    let selectQueryBuilder = dbInstance.selectFrom(tLogs)
        .leftJoin(sourceUserJoin).on(sourceUserJoin.userId.equals(tLogs.logSourceUserId))
        .leftJoin(targetUserJoin).on(targetUserJoin.userId.equals(tLogs.logTargetUserId))
        .select({
            // Columns that will be passed through:
            date: dbInstance.dateTimeAsString(tLogs.logDate),
            id: tLogs.logId,
            severity: tLogs.logSeverity,

            // Columns that will be processed:
            data: tLogs.logData,
            logType: tLogs.logType,

            // Source user:
            sourceUserId: tLogs.logSourceUserId,
            sourceUserName: sourceUserJoin.name,

            // Target user:
            targetUserId: tLogs.logTargetUserId,
            targetUserName: targetUserJoin.name,
        })
        .orderByFromString(normalizeSortModel(params.sort))
        .limitIfValue(params.pagination?.pageSize)
            .offsetIfValue(params.pagination ? params.pagination.page * params.pagination.pageSize
                                             : undefined)
        .where(tLogs.logDeleted.isNull())
            .and(tLogs.logSeverity.in(
                params.severity ?? [ kLogSeverity.Info,
                                     kLogSeverity.Warning,
                                     kLogSeverity.Error ]));

    if (params.sourceOrTargetUserId) {
        selectQueryBuilder = selectQueryBuilder
            .and(tLogs.logSourceUserId.equals(params.sourceOrTargetUserId)
                .or(tLogs.logTargetUserId.equals(params.sourceOrTargetUserId)));
    }

    const { count, data } = await selectQueryBuilder.executeSelectPage();
    if (!count)
        return { messageCount: 0, messages: [ /* database error */ ] };

    const logs: LogMessage[] = [];
    for (const row of data) {
        const formatter = kLogMessageFormatter[row.logType as keyof typeof kLogMessageFormatter];
        const data = row.data ? JSON.parse(row.data) : undefined;

        let source = undefined;
        if (row.sourceUserId && row.sourceUserName)
            source = { userId: row.sourceUserId, name: row.sourceUserName };

        let target = undefined;
        if (row.targetUserId && row.targetUserName)
            target = { userId: row.targetUserId, name: row.targetUserName };

        let message: string;
        switch (typeof formatter) {
            case 'function':
                message = formatter(source, target, data);
                break;

            case 'string':
                message = formatter;
                break;

            default:
                message = row.logType;
                break;
        }

        logs.push({
            data,
            date: row.date,
            id: row.id,
            type: row.logType,
            message,
            severity: row.severity,
            source, target,
        });
    }

    return {
        messageCount: count,
        messages: logs,
    };
}
