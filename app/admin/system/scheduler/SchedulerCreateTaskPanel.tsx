// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type FieldValues, FormContainer, SelectElement, TextFieldElement, useForm }
    from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { callApi } from '@lib/callApi';

/**
 * Panel that enables the administrator to create the `DutyBookSummaryTask`.
 */
function CreateDutyBookSummaryTaskPanel() {
    const kPublishEntryOptions = [
        { id: 'false', label: 'Only generate a summary' },
        { id: 'true', label: 'Publish the incident' },
    ];

    return (
        <Stack sx={{ mt: 2 }} spacing={2}>
            <TextFieldElement name="id" label="Duty Book ID" size="small" fullWidth required
                              type="number" />
            <SelectElement name="publish" label="Publish?" size="small" fullWidth required
                           options={kPublishEntryOptions} />
        </Stack>
    );
}

/**
 * Panel that enables the administrator to create the `ImportActivitiesTask`.
 */
function CreateImportActivitiesTaskPanel() {
    const kSkipMutationLogsOptions = [
        { id: 'false', label: 'Write logs as per usual' },
        { id: 'true', label: 'Skip writing logs' },
    ];

    return (
        <Stack sx={{ mt: 2 }} spacing={2}>
            <TextFieldElement name="festivalId" label="Festival ID" size="small" fullWidth required
                              type="number" />
            <SelectElement name="skipMutationLogs" label="Logs" size="small" fullWidth required
                           options={kSkipMutationLogsOptions} />
        </Stack>
    );
}

/**
 * Panel that enables the administrator to create the `NoopComplexTask`.
 */
function CreateNoopComplexTaskPanel() {
    const kSucceedOptions = [
        { id: 'false', label: 'Fail the task' },
        { id: 'true', label: 'Pass the task' },
    ];

    return (
        <Stack sx={{ mt: 2 }}>
            <SelectElement name="succeed" label="Succeed?" size="small" fullWidth required
                           options={kSucceedOptions} />
        </Stack>
    );
}

/**
 * Set of tasks that can be created using the Web interface.
 */
const kTaskOptions = [
    { id: 'DutyBookSummaryTask', label: 'DutyBookSummaryTask' },
    { id: 'ImportActivitiesTask', label: 'ImportActivitiesTask' },
    { id: 'ImportYourTicketProviderTask', label: 'ImportYourTicketProviderTask' },
    { id: 'NoopComplexTask', label: 'NoopComplexTask' },
    { id: 'NoopTask', label: 'NoopTask' },
    { id: 'PopulateSchedulerTask', label: 'PopulateSchedulerTask' },
];

/**
 * The <SchedulerCreateTaskPanel> component shows a paper listing each of the tasks known to the
 * scheduler, which can be created through a Web interface.
 */
export function SchedulerCreateTaskPanel() {
    const form = useForm();
    const router = useRouter();

    const [ selectedTask, setSelectedTask ] = useState<string | undefined>();

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ success, setSuccess ] = useState<string | undefined>();

    const handleSelectTask = useCallback((task: string) => {
        setSelectedTask(task);
        form.reset({
            festivalId: undefined,
            skipMutationLogs: undefined,
            succeed: undefined,
        });
    }, [ form ]);

    const handleCreateTask = useCallback(async (data: FieldValues) => {
        setLoading(true);
        try {
            const { task, ...params } = data;

            for (const [ key, value ] of Object.entries(params)) {
                if (value === 'true' || value === 'false')
                    params[key] = value === 'true';
            }

            const result = await callApi('post', '/api/admin/scheduler', {
                taskName: task,
                taskParams: params,
                delayMs: 0,
            });

            if (result.success) {
                setSuccess(task);

                router.refresh();
                form.reset({
                    festivalId: undefined,
                    skipMutationLogs: undefined,
                    succeed: undefined,
                });
            } else {
                setError(
                    result.error ?? 'Unable to reset the scheduler, an unknown error occurred');
            }
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ form, router ]);

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
                Schedule a new task
            </Typography>
            <Collapse in={!!error}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            </Collapse>
            <Collapse in={!!success}>
                <Alert severity="success" sx={{ mb: 2 }}>
                    The <strong>{success}</strong> was successfully scheduled.
                </Alert>
            </Collapse>
            <FormContainer context={form} onSuccess={handleCreateTask}>
                <SelectElement name="task" label="Task" size="small" fullWidth required
                               options={kTaskOptions} onChange={handleSelectTask} />
                <Collapse in={selectedTask === 'DutyBookSummaryTask'} mountOnEnter unmountOnExit>
                    <CreateDutyBookSummaryTaskPanel />
                </Collapse>
                <Collapse in={selectedTask === 'ImportActivitiesTask'} mountOnEnter unmountOnExit>
                    <CreateImportActivitiesTaskPanel />
                </Collapse>
                <Collapse in={selectedTask === 'NoopComplexTask'} mountOnEnter unmountOnExit>
                    <CreateNoopComplexTaskPanel />
                </Collapse>
                <Collapse in={!!selectedTask}>
                    <Button type="submit" variant="contained" loading={loading} sx={{ mt: 2 }}>
                        Create task
                    </Button>
                </Collapse>
            </FormContainer>
        </Paper>
    );
}
