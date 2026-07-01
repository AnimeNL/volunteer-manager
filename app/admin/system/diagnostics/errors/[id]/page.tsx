// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import InputIcon from '@mui/icons-material/Input';
import LinkIcon from '@mui/icons-material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PublicIcon from '@mui/icons-material/Public';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tErrorLogs, tUsers } from '@lib/database';

import { kLogSeverity } from '@lib/Log';

/**
 * Page that displays the specific information relating to an individual errors, i.e. where and when
 * did it occur, and what were the details relating to the issue.
 */
export default async function ErrorPage(props: PageProps<'/admin/system/diagnostics/errors/[id]'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    const errorId = parseInt((await props.params).id, 10);
    const usersJoin = tUsers.forUseInLeftJoin();

    const dbInstance = db;
    const entry = await dbInstance.selectFrom(tErrorLogs)
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tErrorLogs.errorUserId))
        .where(tErrorLogs.errorId.equals(errorId))
        .select({
            date: dbInstance.dateTimeAsString(tErrorLogs.errorDate),
            severity: tErrorLogs.errorSeverity,

            error: {
                name: tErrorLogs.errorName,
                message: tErrorLogs.errorMessage,
                stack: tErrorLogs.errorStack,
            },

            source: {
                type: tErrorLogs.errorSource,
                origin: tErrorLogs.errorOrigin,
                pathname: tErrorLogs.errorPathname,

                ipAddress: tErrorLogs.errorIpAddress,
            },

            user: {
                id: usersJoin.userId,
                name: usersJoin.name,
            },
        })
        .executeSelectNoneOrOne();

    if (!entry)
        notFound();

    const { date, error, severity, source, user } = entry;

    let severityChip: React.ReactNode;
    switch (severity) {
        case kLogSeverity.Debug:
        case kLogSeverity.Info:
            // Do not include a severity chip for debug and informational log entries.
            break;

        case kLogSeverity.Warning:
            severityChip = <Chip color="warning" label="Warning" size="small" sx={{ ml: 1 }} />;
            break;

        case kLogSeverity.Error:
            severityChip = <Chip color="error" label="Error" size="small" sx={{ ml: 1 }} />;
            break;
    }

    return (
        <>
            <Section icon={ <ReportGmailerrorredIcon color="primary" /> }
                     title={`Error #${errorId}`}
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'Error logs', href: '/admin/system/diagnostics/errors' },
                         { label: `Error #${errorId}`}
                     ]}>
                <SectionIntroduction>
                    Detailed information about an observed error on the portal.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                     <Typography variant="h6" noWrap>
                        <LocalDateTime dateTime={date} format="dddd, MMMM Do, YYYY [at] HH:mm:ss" />
                     </Typography>
                     {severityChip}
                </Stack>
                <Alert severity="warning">
                    { !!error.name && <strong>{error.name}: </strong> }
                    {error.message}
                </Alert>
                <List dense disablePadding>
                    <ListItem>
                        <ListItemIcon sx={{ minWidth: '48px' }}>
                            <InputIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary="Issue type"
                                      secondary={`${source.type}-side error`} />
                    </ListItem>
                    { !!source.origin &&
                        <ListItem>
                            <ListItemIcon sx={{ minWidth: '48px' }}>
                                <AccountTreeIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText primary="Domain" secondary={source.origin} />
                        </ListItem> }
                    { !!source.pathname &&
                        <ListItem>
                            <ListItemIcon sx={{ minWidth: '48px' }}>
                                <LinkIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText primary="Path" secondary={
                                <MuiLink component={Link} href={source.pathname}>
                                    {source.pathname}
                                </MuiLink>
                            } />
                        </ListItem> }
                    { !!source.ipAddress &&
                        <ListItem>
                            <ListItemIcon sx={{ minWidth: '48px' }}>
                                <PublicIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText slotProps={{ secondary: { component: 'div' } }}
                                        primary="IP address" secondary={
                                <>
                                    {source.ipAddress}
                                    { source.ipAddress === '::1' &&
                                        <Chip color="info" label="dev" size="small"
                                              sx={{ ml: .5 }} /> }
                                </>
                            } />
                        </ListItem> }
                    { !!user &&
                        <ListItem>
                            <ListItemIcon sx={{ minWidth: '48px' }}>
                                <AccountCircleIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText primary="Account" secondary={
                                <MuiLink component={Link}
                                        href={`/admin/organisation/accounts/${user.id}`}>
                                    {user.name}
                                </MuiLink>
                            } />
                        </ListItem> }
                </List>
            </Section>
            { !!error.stack &&
                <Section title="Stack trace">
                    <Typography variant="body2" sx={{
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                    }}>
                        {error.stack}
                    </Typography>
                </Section> }
        </>
    );
}

export const metadata: Metadata = {
    title: 'Issue | Error logs | AnimeCon Volunteer Manager',
};
