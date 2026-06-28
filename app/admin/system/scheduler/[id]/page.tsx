import type { Metadata } from 'next';

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import LoopIcon from '@mui/icons-material/Loop';

import { DetailedLogs } from '../../outbox/email/[id]/DetailedLogs';
import { RerunTaskButton } from './RerunTaskButton';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Temporal, formatDate, formatDuration } from '@lib/Temporal';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tTasks } from '@lib/database';
import { KeyValueList } from '@app/admin/components/KeyValueList';

/**
 * The task page gives details about the execution of an individual task, including all logs, timing
 * and exception information. It allows system administrators to inspect what went wrong.
 */
export default async function TaskPage(props: PageProps<'/admin/system/scheduler/[id]'>) {
    const params = await props.params;

    if (!params.id)
        notFound();

    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.scheduler',
    });

    const task = await db.selectFrom(tTasks)
        .select({
            taskId: tTasks.taskId,
            taskDate: tTasks.taskScheduledDate,
            taskName: tTasks.taskName,
            taskParams: tTasks.taskParams,
            taskParentTaskId: tTasks.taskParentTaskId,
            taskInterval: tTasks.taskScheduledIntervalMs,

            result: tTasks.taskInvocationResult,
            resultLogs: tTasks.taskInvocationLogs,
            resultTimeMs: tTasks.taskInvocationTimeMs,
        })
        .where(tTasks.taskId.equals(parseInt(params.id, 10)))
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

    const taskParamsObject = JSON.parse(task.taskParams);
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
            <Section title="Task information">
                <KeyValueList items={[
                    {
                        key: 'Task name',
                        value: task.taskName,
                    },
                    {
                        key: 'Task parameters',
                        value: taskParamsFormatted,
                    },
                    {
                        key: 'Task parent',
                        value: task.taskParentTaskId,
                    },
                    {
                        key: 'Scheduled date',
                        value: formatDate(task.taskDate, 'YYYY-MM-DD HH:mm:ss'),
                    },
                    {
                        key: 'Scheduled interval',
                        value: taskInterval,
                    }
                ]} />
            </Section>
            { !!task.result &&
                <Section title="Execution details">
                    <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                                Execution result
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 9 }}>
                            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                                <Typography variant="body2">
                                    {task.result}
                                </Typography>
                                <RerunTaskButton taskId={task.taskId} />
                            </Stack>
                        </Grid>

                        <Grid size={{ xs: 12, md: 3 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                                Execution runtime
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 9 }}>
                            <Typography variant="body2">
                                {Math.round((task.resultTimeMs ?? 0) * 10) / 10}ms
                            </Typography>
                        </Grid>
                    </Grid>
                </Section> }

            { !!taskLogs.length && <DetailedLogs logs={taskLogs} /> }
        </>
    );
}

export const metadata: Metadata = {
    title: 'Task | AnimeCon Volunteer Manager',
};
