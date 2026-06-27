// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import { SelectElement, TextFieldElement, useForm } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { FormProvider, FormProviderContext } from '@components/FormProvider';
import { Section } from '@app/admin/components/Section';
import { createSchedulerTask } from './SchedulerActions';

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
    { id: 'DutyBookSummaryTask', label: 'Generate Duty Book Summary' },
    { id: 'ImportActivitiesTask', label: 'Import Activities (AnPlan)' },
    { id: 'ImportYourTicketProviderTask', label: 'Import Sales (YourTicketProvider)' },
    { id: 'NoopComplexTask', label: 'No-op Task (Complex)' },
    { id: 'NoopTask', label: 'No-op Task' },
    { id: 'PopulateSchedulerTask', label: 'Populate Scheduler' },
];

/**
 * Submit section containing the action button and alerts, integrated with FormProvider.
 */
function SchedulerSubmitSection({ selectedTask }: { selectedTask?: string }) {
    const { isPending, result } = useContext(FormProviderContext);

    return (
        <Collapse in={!!selectedTask} sx={{ width: '100%' }} mountOnEnter unmountOnExit>
            <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mt: 2 }}>
                    <Button type="submit" variant="contained" loading={!!isPending}>
                        Create task
                    </Button>
                    { (!!result && !result.success) &&
                        <Alert severity="error" sx={{ flexGrow: 1, py: 0 }}>
                            {result.error || 'An error occurred'}
                        </Alert> }
                    { (!!result && result.success) &&
                        <Alert severity="success" sx={{ flexGrow: 1, py: 0 }}>
                            {result.message || 'The task was successfully scheduled.'}
                        </Alert> }
                </Stack>
            </Grid>
        </Collapse>
    );
}

/**
 * The <SchedulerCreateTaskPanel> component shows a paper listing each of the tasks known to the
 * scheduler, which can be created through a Web interface.
 */
export function SchedulerCreateTaskPanel() {
    const form = useForm();

    const selectedTask = form.watch('task');

    return (
        <Section title="Schedule a new task">
            <FormProvider action={createSchedulerTask} form={form}>
                <Grid container>
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="task" label="Task" size="small" fullWidth required
                                       options={kTaskOptions} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Collapse in={selectedTask === 'DutyBookSummaryTask'}
                                  mountOnEnter unmountOnExit>
                            <CreateDutyBookSummaryTaskPanel />
                        </Collapse>
                        <Collapse in={selectedTask === 'ImportActivitiesTask'}
                                  mountOnEnter unmountOnExit>
                            <CreateImportActivitiesTaskPanel />
                        </Collapse>
                        <Collapse in={selectedTask === 'NoopComplexTask'}
                                  mountOnEnter unmountOnExit>
                            <CreateNoopComplexTaskPanel />
                        </Collapse>
                    </Grid>
                    <SchedulerSubmitSection selectedTask={selectedTask} />
                </Grid>
            </FormProvider>
        </Section>
    );
}
