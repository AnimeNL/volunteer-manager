// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Task, TaskWithParams } from './Task';
import type { TaskContext } from './TaskContext';

/**
 * Constructor type for a registered scheduler task.
 */
type TaskConstructor = new (context: TaskContext) => Task | TaskWithParams<any>;

/**
 * Object containing all tasks known to the AnimeCon Volunteer Manager. Each task must extend either
 * `Task` when no params are expected, or `TaskWithParams` when they are. The primary consumer of
 * the registry is the `TaskRunner`, which is responsible for execution.
 */
export const kTaskRegistry = {
    CancelTicketTask: () =>
        import('./tasks/CancelTicketTask').then(m => m.CancelTicketTask),
    CleanUpExpiredSessionsTask: () =>
        import('./tasks/CleanUpExpiredSessionsTask').then(m => m.CleanUpExpiredSessionsTask),
    CleanUpIntegrationLogsTask: () =>
        import('./tasks/CleanUpIntegrationLogsTask').then(m => m.CleanUpIntegrationLogsTask),
    DutyBookSummaryTask: () =>
        import('./tasks/DutyBookSummaryTask').then(m => m.DutyBookSummaryTask),
    ImportActivitiesTask: () =>
        import('./tasks/ImportActivitiesTask').then(m => m.ImportActivitiesTask),
    ImportEmailTask: () =>
        import('./tasks/ImportEmailTask').then(m => m.ImportEmailTask),
    NoopComplexTask: () =>
        import('./tasks/NoopComplexTask').then(m => m.NoopComplexTask),
    NoopTask: () =>
        import('./tasks/NoopTask').then(m => m.NoopTask),
    PopulateSchedulerTask: () =>
        import('./tasks/PopulateSchedulerTask').then(m => m.PopulateSchedulerTask),
    SendEmailTask: () =>
        import('./tasks/SendEmailTask').then(m => m.SendEmailTask),
    SendSmsTask: () =>
        import('./tasks/SendSmsTask').then(m => m.SendSmsTask),
    SendWhatsappTask: () =>
        import('./tasks/SendWhatsappTask').then(m => m.SendWhatsappTask),
    UpdateTicketTask: () =>
        import('./tasks/UpdateTicketTask').then(m => m.UpdateTicketTask),
    WeeztixImportTask: () =>
        import('./tasks/WeeztixImportTask').then(m => m.WeeztixImportTask),
    YourTicketProviderImportTask: () =>
        import('./tasks/YourTicketProviderImportTask').then(m => m.YourTicketProviderImportTask),
} satisfies Record<string, () => Promise<TaskConstructor>>;

/**
 * Type containing the task names that are known to the scheduler.
 */
export type RegisteredTasks = keyof typeof kTaskRegistry;

/**
 * Tasks that used to exist, but no longer exist, but may still be referred to in UI.
 */
type DeprecatedTasks = 'ImportYourTicketProviderTask';

/**
 * Function defining the formatter for a particular task.
 */
type TaskFormatFn = (params: any) => string;

/**
 * Registry of of the known tasks, each with a function that enables formatting their purpose.
 */
export const kTaskFormatFn: { [k in RegisteredTasks | DeprecatedTasks]: TaskFormatFn } = {
    CancelTicketTask: params => `Cancel ticket (order: ${params.orderId})`,
    CleanUpExpiredSessionsTask: () => 'Clean up expired user sessions',
    CleanUpIntegrationLogsTask: () => 'Clean up old integration logs',
    DutyBookSummaryTask: params => `Generate AI summary for a Duty Book entry (id: ${params.id})`,
    ImportActivitiesTask: () => 'Import activities from AnPlan',
    ImportEmailTask: () => 'Import inbound e-mail from IMAP',
    NoopComplexTask: () => 'No-op task (complex)',
    NoopTask: () => 'No-op task',
    PopulateSchedulerTask: () => 'Populate scheduler task',
    SendEmailTask: params => `Send e-mail task (to: ${params.message.to})`,
    SendSmsTask: params => `Send SMS task (to: ${params.to})`,
    SendWhatsappTask: params => `Send WhatsApp task (to: ${params.to})`,
    UpdateTicketTask: params => `Update ticket (order: ${params.orderId})`,
    WeeztixImportTask: () => 'Import data from Weeztix',
    YourTicketProviderImportTask: () => 'Import data from YourTicketProvider',

    // Deprecated tasks:
    ImportYourTicketProviderTask: () => 'Import data from YourTicketProvider',
};
