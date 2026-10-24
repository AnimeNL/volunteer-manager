// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import Button from '@mui/material/Button';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import LoopIcon from '@mui/icons-material/Loop';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import Stack from '@mui/material/Stack';
import TaskOutlinedIcon from '@mui/icons-material/TaskOutlined';
import Typography from '@mui/material/Typography';

import { DetailedLogs } from '../../outbox/email/[id]/DetailedLogs';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { RerunTaskButton } from './RerunTaskButton';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { formatDuration } from '@lib/Temporal';
import { requireAuthentication } from '@lib/requireAuthentication';
import { rerunSchedulerTask } from '../SchedulerActions';
import db, { tTasks } from '@lib/database';

/**
 * The task page gives details about the execution of an individual task, including all logs, timing
 * and exception information. It allows system administrators to inspect what went wrong.
 */
export default async function TaskPage(props: PageProps<'/admin/system/scheduler/[id]'>) {
    await requireAuthentication('system.internals.scheduler');

    const params = await props.params;

    const taskId = parseInt(params.id, 10);
    if (Number.isNaN(taskId))
        notFound();

    const dbInstance = db;
    const task = await dbInstance.selectFrom(tTasks)
        .select({
            taskId: tTasks.taskId,
            taskDate: dbInstance.dateTimeAsString(tTasks.taskScheduledDate),
            taskName: tTasks.taskName,
            taskParams: tTasks.taskParams,
            taskParentTaskId: tTasks.taskParentTaskId,
            taskInterval: tTasks.taskScheduledIntervalMs,

            result: tTasks.taskInvocationResult,
            resultLogs: tTasks.taskInvocationLogs,
            resultTimeMs: tTasks.taskInvocationTimeMs,
        })
        .where(tTasks.taskId.equals(taskId))
        .executeSelectNoneOrOne();

    if (!task)
        notFound();

    let taskInterval: string | undefined;
    if (!!task.taskInterval) {
        const duration =
            new Temporal.Duration().add({ milliseconds: task.taskInterval })
                .round({ largestUnit: 'hour' });

        taskInterval = formatDuration(duration);
    }

    const repeatFn = rerunSchedulerTask.bind(null, task.taskId, task.taskName);

    const taskParamsObject = !!task.taskParams ? JSON.parse(task.taskParams) : undefined;
    const taskParamsFormatted = JSON.stringify(taskParamsObject, undefined, /* space= */ 4);

    const taskLogs = !!task.resultLogs ? JSON.parse(task.resultLogs)
                                       : [ /* no log entries */ ];

    return (
        <>
            <Section icon={<LoopIcon color="primary" />}
                     title={`Scheduler task #${task.taskId}`}
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Scheduler', href: '/admin/system/scheduler' },
                         { label: `Task #${task.taskId}` },
                     ]}>
                <SectionIntroduction>
                    Detailed information about the execution of an individually scheduled task.
                </SectionIntroduction>
            </Section>
            <Section icon={ <TaskOutlinedIcon /> } title="Task">
                <KeyValueList items={[
                    {
                        key: 'Task name',
                        value: task.taskName,
                    },
                    {
                        key: 'Task parameters',
                        description: 'Internal parameters using which the task was created.',
                        value: taskParamsFormatted,
                        valueTemplate: 'monospace',
                    },
                    {
                        condition: !!task.taskParentTaskId,
                        description:
                            'Task based on which this task was created. Previous instance when ' +
                            'this is a repeating task.',
                        key: 'Task parent',
                        keyAlign: 'center',
                        value: (
                            <Button component={Link}
                                    href={`/admin/system/scheduler/${task.taskParentTaskId}`}
                                    startIcon={ <KeyboardDoubleArrowRightIcon fontSize="small" /> }
                                    size="small" variant="outlined" color="success">
                                To parent task
                            </Button>
                        ),
                    },
                    {
                        key: 'Scheduled date',
                        value: task.taskDate,
                        valueTemplate: 'localDateTime',
                    },
                    {
                        condition: !!taskInterval,
                        key: 'Scheduled interval',
                        value: taskInterval,
                    }
                ]} />
            </Section>
            { !!task.result &&
                <Section icon={ <PlayCircleOutlinedIcon /> } title="Execution">
                    <KeyValueList items={[
                        {
                            key: 'Result',
                            keyAlign: 'center',
                            value: (
                                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                                    <Typography variant="body2">
                                        {task.result}
                                    </Typography>
                                    <RerunTaskButton repeatFn={repeatFn} />
                                </Stack>
                            ),
                            valueTemplate: 'component',
                        },
                        {
                            key: 'Runtime',
                            value: `${Math.round((task.resultTimeMs ?? 0) * 10) / 10}ms`,
                        },
                    ]} />
                </Section> }
            { !!taskLogs.length && <DetailedLogs logs={taskLogs} /> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'Task #' }, 'Scheduler', 'System');
