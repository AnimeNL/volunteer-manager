// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import Alert from '@mui/material/Alert';
import LoopIcon from '@mui/icons-material/Loop';

import { SchedulerCreateTaskPanel } from './SchedulerCreateTaskPanel';
import { SchedulerTaskTable } from './SchedulerTaskTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { globalScheduler } from '@lib/scheduler/SchedulerImpl';

/**
 * The scheduler page gives an overview of the scheduler's state - both pending and past tasks, with
 * the ability to schedule a new task when so desired.
 */
export default async function SchedulerPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.scheduler',
    });

    return (
        <>
            <Section icon={ <LoopIcon color="primary" /> } title="System scheduler" breadcrumbs={[
                { label: 'System', href: '/admin/system' },
                { label: 'Scheduler' },
            ]}>
                <SectionIntroduction>
                    The <strong>system scheduler</strong> is the component to run tasks (such as sending
                    an e-mail) in the background, either as a one-off or at a configured interval.
                </SectionIntroduction>
                { !globalScheduler.lastExecution &&
                    <Alert severity="error" variant="filled">
                        The scheduler is not running on this Volunteer Manager instance.
                    </Alert> }
            </Section>
            <Section noHeader>
                <SchedulerTaskTable />
            </Section>
            <SchedulerCreateTaskPanel />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Scheduler | AnimeCon Volunteer Manager',
};
