// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { formatDate } from '@lib/Temporal';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tLogs } from '@lib/database';

import { kLogType } from '@lib/Log';

/**
 * This page provides details about a particular database error, such as the full error and the
 * query that was being executed.
 */
export default async function DatabaseErrorLogPage(
    props: PageProps<'/admin/system/logs/database-error/[id]'>)
{
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    const { id } = await props.params;

    const entry = await db.selectFrom(tLogs)
        .where(tLogs.logId.equals(parseInt(id, /* radix= */ 10)))
            .and(tLogs.logType.equals(kLogType.DatabaseError))
            .and(tLogs.logDeleted.isNull())
        .select({
            id: tLogs.logId,
            date: tLogs.logDate,
            data: tLogs.logData,
        })
        .executeSelectNoneOrOne();

    if (!entry || !entry.data)
        return notFound();

    const { message, query, stack, params } = JSON.parse(entry.data);

    return (
        <>
            <Section title="Database Error">
                <SectionIntroduction>
                    Error seen on { formatDate(entry.date, 'dddd, MMMM Do, YYYY [at] HH:mm:ss') }.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <SectionIntroduction important>
                    {message}
                </SectionIntroduction>
                <Typography>
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
            </Section>
            { !!stack &&
                <Section noHeader>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre' }}>
                        {stack}
                    </Typography>
                </Section> }
        </>
    );
}

export const metadata: Metadata = {
    title: 'Database Error | Logs | AnimeCon Volunteer Manager',
};
