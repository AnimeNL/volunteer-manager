// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { after } from 'next/server';
import { headers } from 'next/headers';

import type { User } from '@lib/auth/User';
import { PlaywrightHooks } from './PlaywrightHooks';
import db, { tLogs } from '@lib/database';

/**
 * Enumeration containing all the valid log severities. Will be stored as a string, and must be kept
 * in sync with the column definition in the database.
 *
 * @see Table `logs`
 */
export type LogSeverity = typeof kLogSeverity[keyof typeof kLogSeverity];
export const kLogSeverity = {
    Debug: 'Debug',
    Info: 'Info',
    Warning: 'Warning',
    Error: 'Error',
} as const;

/**
 * Enumeration containing all the valid log types. Will be stored as a string, so keep alphabetized.
 */
export const kLogType = {
    AccountActivate: 'account-activate',
    AccountIdentifyAccessCode: 'account-identify-access-code',
    AccountIdentifyPasskey: 'account-identify-passkey',
    AccountIdentifyPassword: 'account-identify-password',
    AccountIdentityCheck: 'account-identity-check',
    AccountPasskeyCreate: 'account-passkey-create',
    AccountPasskeyDelete: 'account-passkey-delete',
    AccountPasswordResetRequest: 'account-password-reset-request',
    AccountPasswordReset: 'account-password-reset',
    AccountPasswordUpdate: 'account-password-update',
    AccountRegister: 'account-register',
    AccountUpdateAvatar: 'account-update-avatar',
    AccountUpdate: 'account-update',
    AdminAccessVolunteerInfo: 'admin-access-volunteer-info',
    AdminClearHotelPreferences: 'admin-clear-hotel-preferences',
    AdminClearRefundRequest: 'admin-clear-refund-request',
    AdminClearTrainingPreferences: 'admin-clear-training-preferences',
    AdminCreateRole: 'admin-create-role',
    AdminDisplayMutation: 'admin-display-mutation',
    AdminContentMutation: 'admin-content-mutation',
    AdminEventApplication: 'admin-event-application',
    AdminEventCreate: 'admin-event-create',
    AdminEventDeadlineMutation: 'admin-event-deadline-mutation',
    AdminEventHotelMutation: 'admin-event-hotel',
    AdminEventProgramRequestUpdate: 'admin-event-program-request-update',
    AdminEventPublishInfo: 'admin-event-publish-info',
    AdminEventRetentionMessage: 'admin-event-retention-message',
    AdminEventRetentionUpdate: 'admin-event-retention-update',
    AdminEventRoleUpdate: 'admin-event-role-update',
    AdminEventShiftCategoryMutation: 'admin-event-shift-category-mutation',
    AdminEventShiftMutation: 'admin-event-shift-mutation',
    AdminEventTeamUpdate: 'admin-event-team-update',
    AdminEventTrainingAssignment: 'admin-event-training-assignment',
    AdminEventTrainingMutation: 'admin-event-training',
    AdminEventTrainingExtraMutation: 'admin-event-training-extra',
    AdminExportMutation: 'admin-export-mutation',
    AdminHotelAssignVolunteer: 'admin-hotel-assign-volunteer',
    AdminHotelAssignVolunteerDelete: 'admin-hotel-assign-volunteer-delete',
    AdminHotelBookingMutation: 'admin-hotel-booking-mutation',
    AdminImpersonateVolunteer: 'admin-impersonate-volunteer',
    AdminKnowledgeBaseCategoryMutation: 'admin-knowledge-base-category-mutation',
    AdminKnowledgeBaseMutation: 'admin-knowledge-base-mutation',
    AdminNardoMutation: 'admin-nardo-mutation',
    AdminProgramMutation: 'admin-program-mutation',
    AdminRefundMutation: 'admin-refund-mutation',
    AdminResetAccessCode: 'admin-reset-access-code',
    AdminResetPasswordLink: 'admin-reset-password-link',
    AdminSubscriptionUpdate: 'admin-subscription-update',
    AdminUpdateActivation: 'admin-update-activation',
    AdminUpdateAiSetting: 'admin-update-ai-settings',
    AdminUpdateAvailabilityPreferences: 'admin-update-availability-preferences',
    AdminUpdateAvatar: 'admin-update-avatar',
    AdminUpdateEnvironment: 'admin-update-environment',
    AdminUpdateEvent: 'admin-update-event',
    AdminUpdateHotelPreferences: 'admin-update-hotel-preferences',
    AdminUpdateIntegration: 'admin-update-integration',
    AdminUpdatePermission: 'admin-update-permission',
    AdminUpdateRefundRequest: 'admin-update-refund-request',
    AdminUpdateRole: 'admin-update-role',
    AdminUpdateSettings: 'admin-update-settings',
    AdminUpdateTeam: 'admin-update-team',
    AdminUpdateTeamVolunteer: 'admin-update-team-volunteer',
    AdminUpdateTeamVolunteerStatus: 'admin-update-team-volunteer-status',
    AdminUpdateTrainingPreferences: 'admin-update-training-preferences',
    AdminUpdateVolunteer: 'admin-update-volunteer',
    AdminVendorMutation: 'admin-vendor-mutation',
    AdminVendorScheduleUpdate: 'admin-vendor-schedule-update',
    ApplicationAvailabilityPreferences: 'application-availability-preferences',
    ApplicationHotelPreferences: 'application-hotel-preferences',
    ApplicationRefundRequest: 'application-refund-request',
    ApplicationTrainingPreferences: 'application-training-preferences',
    DatabaseError: 'database-error',
    EventApplication: 'event-application',
    EventFeedbackSubmitted: 'event-feedback-submitted',
    EventHelpRequestUpdate: 'event-help-request-update',
    EventVolunteerNotes: 'event-volunteer-notes',
    ExportDataAccess: 'export-data-access',
} as const;

/**
 * Enumeration containing all the valid log types. Will be stored as a string, so keep alphabetized.
 */
export type LogType = typeof kLogType[keyof typeof kLogType];

/**
 * Information about what happened that should be logged for future inspection. Not all fields are
 * necessary, but a basic log entry has a severity and a type.
 */
export interface LogEntry {
    /**
     * Data pertaining to the cause of the entry, if applicable. Will be stored as JSON.
     */
    data?: any;

    /**
     * Severity of the log entry that's being logged. Defaults to "Info".
     */
    severity?: LogSeverity,

    /**
     * Information about the user who caused this log entry to be created.
     */
    sourceUser?: User | number;

    /**
     * The user about whom the log entry is being created.
     */
    targetUser?: User | number;

    /**
     * The type of log entry that's being written.
     */
    type: LogType;
}

/**
 * Logs the given `entry` to the database. This function will be executed after the current request
 * has completed, to avoid blocking the response as users don't get value out of log entries.
 */
export function RecordLog(entry: LogEntry): void {
    const { sourceUser, targetUser } = entry;

    let sourceUserId: number | null = null;
    if (sourceUser)
        sourceUserId = typeof sourceUser === 'number' ? sourceUser : sourceUser.userId;

    let targetUserId: number | null = null;
    if (targetUser)
        targetUserId = typeof targetUser === 'number' ? targetUser : targetUser.userId;

    const data = entry.data ? JSON.stringify(entry.data) : null;
    const severity = entry.severity ?? kLogSeverity.Info;

    if (PlaywrightHooks.isActive() && PlaywrightHooks.isPlaywrightUser(sourceUserId, targetUserId))
        return;  // don't create log entries on behalf of Playwright users

    after(async () => {
        const requestHeaders = await headers();

        const logSourceIpAddress = requestHeaders.get('x-forwarded-for');
        const logSourceUserAgent = requestHeaders.get('user-agent');

        await db.insertInto(tLogs)
            .values({
                logType: entry.type,
                logSeverity: severity,
                logSourceUserId: sourceUserId,
                logSourceIpAddress,
                logSourceUserAgent,
                logTargetUserId: targetUserId,
                logData: data,
            }).executeInsert();
    });
}

/**
 * Version of `RecordLog` that will write the given `entry` to the database immediately, in a way
 * that can be waited on. Should be used sparsely, generally `RecordLog` should be preferred unless
 * the log might be issued outside of a request context.
 */
export async function RecordLogImmediate(entry: LogEntry): Promise<void> {
    const { sourceUser, targetUser } = entry;

    let sourceUserId: number | null = null;
    if (sourceUser)
        sourceUserId = typeof sourceUser === 'number' ? sourceUser : sourceUser.userId;

    let targetUserId: number | null = null;
    if (targetUser)
        targetUserId = typeof targetUser === 'number' ? targetUser : targetUser.userId;

    const data = entry.data ? JSON.stringify(entry.data) : null;
    const severity = entry.severity ?? kLogSeverity.Info;

    if (PlaywrightHooks.isActive() && PlaywrightHooks.isPlaywrightUser(sourceUserId, targetUserId))
        return;  // don't create log entries on behalf of Playwright users

    let logSourceIpAddress: string | null = null;
    let logSourceUserAgent: string | null = null;

    try {
        const requestHeaders = await headers();

        logSourceIpAddress = requestHeaders.get('x-forwarded-for');
        logSourceUserAgent = requestHeaders.get('user-agent');

    } catch (error) { /* ignore for non-request contexts */ }

    await db.insertInto(tLogs)
        .values({
            logType: entry.type,
            logSeverity: severity,
            logSourceUserId: sourceUserId,
            logSourceIpAddress,
            logSourceUserAgent,
            logTargetUserId: targetUserId,
            logData: data,
        }).executeInsert();
}
