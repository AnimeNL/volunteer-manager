// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import ApiIcon from '@mui/icons-material/Api';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InputIcon from '@mui/icons-material/Input';
import OutputIcon from '@mui/icons-material/Output';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import Typography from '@mui/material/Typography';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication, and } from '@lib/requireAuthentication';
import db, { tIntegrationsLogs, tTasks, tUsers } from '@lib/database';

import { kIntegrationLogStatus } from '@lib/database/Types';

/**
 * Formats a logged integration payload as pretty-printed JSON when possible, falling back to the
 * raw string representation otherwise.
 */
function formatPayload(payload?: string): string | undefined {
    if (!payload)
        return undefined;

    try {
        return JSON.stringify(JSON.parse(payload), undefined, /* space= */ 4);
    } catch {
        return payload;
    }
}

/**
 * The integration log detail page displays all recorded information about an individual external
 * API call made by the Volunteer Manager, including its input, output, timing and any exceptions.
 */
export default async function IntegrationLogDetailsPage(
    props: PageProps<'/admin/system/diagnostics/integrations/[id]'>)
{
    const { access } = await requireAuthentication(and(
        {
            permission: 'system.integrations',
        },
        {
            permission: 'system.logs',
            operation: 'read',
        }));

    const params = await props.params;

    const logId = parseInt(params.id, /* radix= */ 10);
    if (Number.isNaN(logId))
        notFound();

    const tasksJoin = tTasks.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoin();

    const dbInstance = db;
    const entry = await dbInstance.selectFrom(tIntegrationsLogs)
        .leftJoin(tasksJoin)
            .on(tasksJoin.taskId.equals(tIntegrationsLogs.logTaskId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tIntegrationsLogs.logUserId))
        .where(tIntegrationsLogs.logId.equals(logId))
        .select({
            id: tIntegrationsLogs.logId,
            date: dbInstance.dateTimeAsString(tIntegrationsLogs.logDate),
            integration: tIntegrationsLogs.logIntegration,
            operation: tIntegrationsLogs.logOperation,
            status: tIntegrationsLogs.logStatus,

            user: {
                id: usersJoin.userId,
                name: usersJoin.name,
            },
            task: {
                id: tasksJoin.taskId,
                name: tasksJoin.taskName,
            },

            input: tIntegrationsLogs.logInput,
            output: tIntegrationsLogs.logOutput,

            durationMs: tIntegrationsLogs.logDurationMs,
            durationTtfbMs: tIntegrationsLogs.logDurationTtfbMs,

            errorName: tIntegrationsLogs.logErrorName,
            errorMessage: tIntegrationsLogs.logErrorMessage,
            errorCause: tIntegrationsLogs.logErrorCause,
            errorStack: tIntegrationsLogs.logErrorStack,
        })
        .executeSelectNoneOrOne();

    if (!entry)
        notFound();

    const canAccessScheduler = access.can('system.internals.scheduler');

    const formattedInput = formatPayload(entry.input);
    const formattedOutput = formatPayload(entry.output);

    const performanceUrl =
        `/admin/system/diagnostics/integrations/performance` +
        `?integration=${encodeURIComponent(entry.integration)}` +
        `&operation=${encodeURIComponent(entry.operation)}`;

    return (
        <>
            <Section icon={ <ApiIcon color="primary" /> }
                     title={`${entry.integration} #${entry.id}`}
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         {
                             label: 'Integration logs',
                             href: '/admin/system/diagnostics/integrations',
                         },
                         { label: `${entry.integration} #${entry.id}` },
                     ]}>
                <SectionIntroduction>
                    Detailed information about an integration call made to {entry.integration}.
                </SectionIntroduction>
            </Section>
            <Section tabs back="Back to integration logs" noHeader>
                <KeyValueList items={[
                    {
                        key: 'Date',
                        value: entry.date,
                        valueTemplate: 'localDateTime',
                    },
                    {
                        key: 'Status',
                        keyAlign: 'center',
                        value: (
                            <>
                                { entry.status === kIntegrationLogStatus.Success &&
                                    <Chip label="success" size="small" color="success"
                                          component="span" /> }
                                { entry.status === kIntegrationLogStatus.Failure &&
                                    <Chip label="failure" size="small" color="error"
                                          component="span" /> }
                                { entry.status === kIntegrationLogStatus.Exception &&
                                    <Chip label="exception" size="small" color="error"
                                          component="span" /> }
                            </>
                        ),
                    },
                    {
                        key: 'Integration',
                        value: entry.integration,
                    },
                    {
                        key: 'Operation',
                        value: entry.operation,
                        valueTemplate: 'monospace',
                    },
                    {
                        condition: !!entry.user,
                        key: 'Account',
                        value: entry.user,
                        valueTemplate: 'account',
                    },
                    {
                        condition: !!entry.task && !canAccessScheduler,
                        key: 'Task',
                        value: `${entry.task?.name} (#${entry.task?.id})`,
                    },
                    {
                        condition: !!entry.task && canAccessScheduler,
                        key: 'Task',
                        value: (
                            <MuiLink component={Link}
                                     href={`/admin/system/scheduler/${entry.task?.id}`}>
                                {entry.task?.name} (#{entry.task?.id})
                            </MuiLink>
                        ),
                    },
                    {
                        condition: entry.durationTtfbMs !== undefined,
                        description: 'Time elapsed until the first byte of the response arrived.',
                        key: 'Time to first byte',
                        value: `${Math.round((entry.durationTtfbMs ?? 0) * 10) / 10}ms`,
                    },
                    {
                        condition: entry.durationMs !== undefined,
                        description: 'Total time elapsed for the integration call to complete.',
                        key: 'Duration',
                        value: `${Math.round((entry.durationMs ?? 0) * 10) / 10}ms`,
                    },
                ]} />
                <Button LinkComponent={Link} href={performanceUrl} size="small" variant="outlined"
                        startIcon={ <ShowChartIcon /> }>
                    View performance metrics…
                </Button>
            </Section>
            { !!formattedInput &&
                <Section icon={ <InputIcon /> } title="Input">
                    <Typography variant="body2" sx={{
                        fontFamily: 'monospace',
                        maxHeight: '300px',
                        overflowWrap: 'anywhere',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                    }}>
                        {formattedInput}
                    </Typography>
                </Section> }
            { !!formattedOutput &&
                <Section icon={ <OutputIcon /> } title="Output">
                    <Typography variant="body2" sx={{
                        fontFamily: 'monospace',
                        maxHeight: '300px',
                        overflowWrap: 'anywhere',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                    }}>
                        {formattedOutput}
                    </Typography>
                </Section> }
            { !!entry.errorName &&
                <Section icon={ <ErrorOutlinedIcon /> } title="Error">
                    <Alert
                        severity={
                            entry.status === kIntegrationLogStatus.Failure ? 'warning' : 'error'
                        }>
                        { entry.status === kIntegrationLogStatus.Failure
                            ? 'The integration call returned a failure response.'
                            : 'An exception occurred when executing this integration call.' }
                    </Alert>
                    <KeyValueList items={[
                        {
                            key: 'Name',
                            value: entry.errorName,
                        },
                        {
                            key: 'Message',
                            value: entry.errorMessage,
                        },
                        {
                            condition: !!entry.errorCause,
                            key: 'Cause',
                            value: entry.errorCause,
                            valueTemplate: 'monospace',
                        },
                        {
                            condition: !!entry.errorStack,
                            key: 'Stack',
                            value: entry.errorStack,
                            valueTemplate: 'monospace',
                        },
                    ]} />
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id' }, 'Integration logs', 'Diagnostics', 'System');
