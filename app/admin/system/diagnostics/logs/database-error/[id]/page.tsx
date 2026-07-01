// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import Typography from '@mui/material/Typography';

import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tLogs } from '@lib/database';

import { kLogType } from '@lib/Log';

/**
 * This page provides details about a particular database error, such as the full error and the
 * query that was being executed.
 */
export default async function DatabaseErrorLogPage(
    props: PageProps<'/admin/system/diagnostics/logs/database-error/[id]'>)
{
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    const { id } = await props.params;

    const dbInstance = db;
    const entry = await dbInstance.selectFrom(tLogs)
        .where(tLogs.logId.equals(parseInt(id, /* radix= */ 10)))
            .and(tLogs.logType.equals(kLogType.DatabaseError))
            .and(tLogs.logDeleted.isNull())
        .select({
            id: tLogs.logId,
            date: dbInstance.dateTimeAsString(tLogs.logDate),
            data: tLogs.logData,
        })
        .executeSelectNoneOrOne();

    if (!entry || !entry.data)
        return notFound();

    const { message, query, stack, params } = JSON.parse(entry.data);

    return (
        <>
            <Section icon={ <StorageOutlinedIcon color="primary" /> }
                     title={`Database error #${entry.id}`}
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'System logs', href: '/admin/system/diagnostics/logs' },
                         { label: `Database error #${entry.id}` },
                     ]}>
                <SectionIntroduction>
                    Detailed information about an observed database error.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <Typography variant="h6">
                    <LocalDateTime dateTime={entry.date}
                                   format="dddd, MMMM Do, YYYY [at] HH:mm:ss" />
                </Typography>
                <Alert severity="warning">
                    {message}
                </Alert>
                <Typography variant="body2" sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere'
                }}>
                    { query.split(/(\?)/g).map((part: string, index: number) =>
                        part === '?' ? <mark key={index}>{part}</mark>
                                        : <span key={index}>{part}</span> )}
                </Typography>
                { (params && Array.isArray(params)) &&
                    <>
                        <Divider />
                        <Stack>
                            { params.map((param: string, index: number) =>
                                <Typography key={index}>
                                    <strong>Param {index}</strong>: {param}
                                </Typography> )}
                        </Stack>
                    </> }
                { !!stack &&
                    <>
                        <Divider />
                        <Typography variant="body2" sx={{
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere'
                        }}>
                            {stack}
                        </Typography>
                    </> }
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Database Error | System logs | AnimeCon Volunteer Manager',
};
