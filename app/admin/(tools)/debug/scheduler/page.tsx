// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import Button from '@mui/material/Button';
import ReplayIcon from '@mui/icons-material/Replay';
import Stack from '@mui/material/Stack';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TaskContext } from '@lib/scheduler/TaskContext';
import { YourTicketProviderImportTask } from '@lib/scheduler/tasks/YourTicketProviderImportTask';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * Zod schema describing the task execution request.
 */
const kExecuteSchedulerTaskData = z.object({
    taskName: z.enum([ 'YourTicketProviderImportTask' ]),
});

/**
 * Server Action through which the given `taskName` can be scheduled.
 */
async function executeSchedulerTask(taskName: string) {
    'use server';
    await executeServerAction(
        { taskName }, kExecuteSchedulerTaskData, async (data, props) =>
    {
        await requireAuthentication(props.authenticationContext, 'system.internals.debug');

        switch (data.taskName) {
            case 'YourTicketProviderImportTask': {
                const taskContext =
                    TaskContext.forEphemeralTask(data.taskName, { /* no params */ });
                const task = new YourTicketProviderImportTask(taskContext);
                try {
                    await task.execute();
                } catch (error: any) {
                    console.error(error);
                } finally {
                    console.log(taskContext.log.entries);
                }

                break;
            }
        }

        return { success: true };
    });
}

/**
 * Page that allows individual tasks to be executed directly without depending on the scheduler.
 */
export default async function SchedulerDebugPage() {
    await requireAuthentication('system.internals.debug');

    const yourTicketProviderImportTaskFn =
        executeSchedulerTask.bind(null, 'YourTicketProviderImportTask');

    return (
        <>
            <Section icon={ <BugReportOutlinedIcon color="primary" /> } title="Scheduler"
                     breadcrumbs={[
                         { label: 'Debug', href: '/admin/debug' },
                         { label: 'Scheduler' },
                     ]}>
                <SectionIntroduction>
                    Ability to execute various tasks without having to schedule them.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <Stack direction="column" spacing={1.5}>
                    <Button size="small" variant="outlined" startIcon={ <ReplayIcon /> }
                            onClick={yourTicketProviderImportTaskFn}>
                        YourTicketProvider Import Task
                    </Button>
                </Stack>
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Scheduler', 'Debug');
