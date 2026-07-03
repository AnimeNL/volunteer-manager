// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import LoopIcon from '@mui/icons-material/Loop';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { DateCell, IntervalCell, IntervalHeader, StateCell, StateHeader } from './SchedulerCells';
import { SchedulerCreateTaskPanel } from './SchedulerCreateTaskPanel';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { globalScheduler } from '@lib/scheduler/SchedulerImpl';
import db, { tTasks } from '@lib/database';

import { kTaskFormatFn } from '@lib/scheduler/TaskRegistry';
import { kTaskResult } from '@lib/database/Types';

/**
 * Data source through which the scheduler tasks can be retrieved.
 */
const schedulerDataSource = createDataSource('admin/system/scheduler', withRowModel({
    /**
     * Unique ID of the content as it exists in the database.
     */
    id: z.number(),

    /**
     * Unique ID of the parent task of this task as it exists in the database.
     */
    parentId: z.number().optional(),

    /**
     * State of the task as it should be displayed.
     */
    state: z.enum([ 'pending', 'success', 'warning', 'failure' ]),

    /**
     * Date on which the task has been scheduled to execute.
     */
    date: z.string(),

    /**
     * Name of the task that's been scheduled for execution.
     */
    task: z.string(),

    /**
     * Interval of the task, in case it's repeating.
     */
    executionInterval: z.number().optional(),

    /**
     * Execution time of the task, formatted for display.
     */
    executionTimeLabel: z.string(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.scheduler',
        });
    },

    async list(params, props) {
        let sortField: 'date' | 'executionTime' | 'task' = 'date';
        switch (params.sort.field) {
            case 'executionTimeLabel':
                sortField = 'executionTime';
                break;
            case 'task':
                sortField = 'task';
                break;
        }

        const dbInstance = db;
        const tasks = await dbInstance.selectFrom(tTasks)
            .where(tTasks.taskName.containsInsensitiveIfValue(params.search))
                .or(tTasks.taskParams.containsInsensitiveIfValue(params.search))
            .select({
                id: tTasks.taskId,
                parentId: tTasks.taskParentTaskId,
                date: dbInstance.dateTimeAsString(tTasks.taskScheduledDate),
                task: tTasks.taskName,
                params: tTasks.taskParams,
                executionResult: tTasks.taskInvocationResult,
                executionInterval: tTasks.taskScheduledIntervalMs,
                executionTime: tTasks.taskInvocationTimeMs,
            })
            .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: tasks.count,
            rows: tasks.data.map(row => {
                let taskName = row.task;
                if (Object.hasOwn(kTaskFormatFn, row.task)) {
                    try {
                        const params = JSON.parse(row.params ?? /* no params */ '{}');
                        taskName = kTaskFormatFn[row.task as keyof typeof kTaskFormatFn](params);
                    } catch (_error) { /* no failure handling */ }
                }

                let state: 'pending' | 'success' | 'warning' | 'failure' = 'pending';
                if (!!row.executionResult) {
                    if (row.executionResult === kTaskResult.TaskSuccess) {
                        state = 'success';
                    } else {
                        state = 'failure';
                    }
                }

                let executionTimeLabel = 'n/a';
                if (row.executionTime) {
                    if (row.executionTime < 10) {
                        executionTimeLabel = `${Math.round(row.executionTime * 10) / 10}ms`;
                    } else if (row.executionTime < 1000) {
                        executionTimeLabel = `${Math.round(row.executionTime)}ms`;
                    } else if (row.executionTime < 60000) {
                        executionTimeLabel = `${Math.round(row.executionTime / 1000)}s`;
                    } else {
                        executionTimeLabel = `${Math.round(row.executionTime / 60000)}m`;
                    }
                }

                return {
                    id: row.id,
                    parentId: row.parentId,
                    state,
                    date: row.date,
                    task: taskName,
                    executionInterval: row.executionInterval,
                    executionTimeLabel,
                };
            }),
        };
    },
});

/**
 * The scheduler page gives an overview of the scheduler's state - both pending and past tasks, with
 * the ability to schedule a new task when so desired.
 */
export default async function SchedulerPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.scheduler',
    });

    const columns: Column<ExtractRowModel<typeof schedulerDataSource>>[] = [
        {
            field: 'state',
            headerAlign: 'center',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: StateHeader,
                component: StateCell,
            },
        },
        {
            field: 'date',
            headerName: 'Scheduled for…',
            sortable: true,
            width: 205,

            template: 'component',
            templateProps: {
                component: DateCell,
            },
        },
        {
            field: 'task',
            headerName: 'Task',
            sortable: true,
            flex: 2,

            template: 'text',
            templateProps: {
                href: './scheduler/{id}',
            },
        },
        {
            field: 'executionInterval',
            headerAlign: 'center',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: IntervalHeader,
                component: IntervalCell,
            },
        },
        {
            field: 'executionTimeLabel',
            headerName: 'Time',
            sortable: true,
            width: 100,
        },
    ];

    return (
        <>
            <Section icon={ <LoopIcon color="primary" /> } title="System scheduler" breadcrumbs={[
                { label: 'System', href: '/admin/system' },
                { label: 'Scheduler' },
            ]}>
                <SectionIntroduction>
                    The <strong>system scheduler</strong> runs background tasks (such as sending
                    an e-mail), either as a one-off or at a configured interval.
                </SectionIntroduction>
                { !globalScheduler.lastExecution &&
                    <Alert severity="error" variant="filled">
                        The scheduler is not running on this Volunteer Manager instance.
                    </Alert> }
            </Section>
            <Section noHeader>
                <DataTable
                    columns={columns}
                    source={schedulerDataSource}
                    defaultSort={{ field: 'date', sort: 'desc' }}
                    pageSize={25}
                    listViewProps={{
                        primaryField: 'task',
                        secondaryTemplate: 'Runtime: {executionTimeLabel}',
                        dateField: 'date',
                        startComponent: StateCell,
                        linkTemplate: './scheduler/{id}',
                    }}
                />
            </Section>
            <SchedulerCreateTaskPanel />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Scheduler | AnimeCon Volunteer Manager',
};
