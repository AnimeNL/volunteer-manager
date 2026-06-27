// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { DetailedLogs } from './DetailedLogs';
import { Temporal, formatDate } from '@lib/Temporal';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tOutboxEmail } from '@lib/database';

/**
 * The message outbox page displays an individual message that was sent through the Volunteer
 * Manager. It includes all metainformation, including logs regarding the result.
 */
export default async function OutboxEmailPage(props: PageProps<'/admin/system/outbox/email/[id]'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    const params = await props.params;
    const id = parseInt(params.id, 10);
    if (isNaN(id))
        notFound();

    const dbInstance = db;
    const message = await dbInstance.selectFrom(tOutboxEmail)
        .select({
            // Basic fields:
            id: tOutboxEmail.outboxEmailId,
            date: dbInstance.dateTimeAsString(tOutboxEmail.outboxTimestamp),
            from: tOutboxEmail.outboxSender,
            fromUserId: tOutboxEmail.outboxSenderUserId,
            to: tOutboxEmail.outboxTo,
            toUserId: tOutboxEmail.outboxToUserId,
            subject: tOutboxEmail.outboxSubject,
            delivered:
                tOutboxEmail.outboxResultAccepted.length().greaterThan(0).valueWhenNull(false),

            // Detailed fields:
            cc: tOutboxEmail.outboxCc,
            bcc: tOutboxEmail.outboxBcc,

            headers: tOutboxEmail.outboxHeaders,

            // Message content:
            text: tOutboxEmail.outboxBodyText,
            html: tOutboxEmail.outboxBodyHtml,

            // Message logs:
            logs: tOutboxEmail.outboxLogs,

            // Message error:
            errorName: tOutboxEmail.outboxErrorName,
            errorMessage: tOutboxEmail.outboxErrorMessage,
            errorStack: tOutboxEmail.outboxErrorStack,
            errorCause: tOutboxEmail.outboxErrorCause,

            // Message result:
            messageId: tOutboxEmail.outboxResultMessageId,
            accepted: tOutboxEmail.outboxResultAccepted,
            rejected: tOutboxEmail.outboxResultRejected,
            pending: tOutboxEmail.outboxResultPending,
            response: tOutboxEmail.outboxResultResponse,
        })
        .where(tOutboxEmail.outboxEmailId.equals(id))
        .executeSelectNoneOrOne();

    if (!message)
        notFound();

    const logs = !!message.logs ? JSON.parse(message.logs) : [];

    return (
        <Stack direction="column" spacing={2}>
            <Typography variant="h5">
                Message sent on {
                    formatDate(
                        Temporal.ZonedDateTime.from(message.date).withTimeZone(
                            Temporal.Now.timeZoneId()),
                        'MMMM D, YYYY [at] H:mm:ss') }
            </Typography>
            <TableContainer component={Paper} variant="outlined">
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">From</TableCell>
                            { !message.fromUserId && <TableCell>{message.from}</TableCell> }
                            { !!message.fromUserId &&
                                <TableCell>
                                    <MuiLink
                                        component={Link}
                                        href={`/admin/organisation/accounts/${message.fromUserId}`}>
                                        {message.from}
                                    </MuiLink>
                                </TableCell> }
                        </TableRow>
                        <TableRow>
                            <TableCell component="th" scope="row">To</TableCell>
                            { !message.toUserId && <TableCell>{message.to}</TableCell> }
                            { !!message.toUserId &&
                                <TableCell>
                                    <MuiLink component={Link}
                                             href={`/admin/organisation/accounts/${message.toUserId}`}>
                                        {message.to}
                                    </MuiLink>
                                </TableCell> }
                        </TableRow>
                        { !!message.cc &&
                            <TableRow>
                                <TableCell component="th" scope="row">Cc</TableCell>
                                <TableCell>{message.cc}</TableCell>
                            </TableRow> }
                        { !!message.bcc &&
                            <TableRow>
                                <TableCell component="th" scope="row">Bcc</TableCell>
                                <TableCell>{message.bcc}</TableCell>
                            </TableRow> }
                        <TableRow>
                            <TableCell component="th" scope="row">Subject</TableCell>
                            <TableCell>{message.subject}</TableCell>
                        </TableRow>
                        { (!!message.headers && message.headers.length > 2) &&
                            <TableRow>
                                <TableCell component="th" scope="row">Headers</TableCell>
                                <TableCell sx={{ whiteSpace: 'pre-line' }}>
                                    {JSON.stringify(message.headers)}
                                </TableCell>
                            </TableRow> }
                    </TableBody>
                </Table>
            </TableContainer>
            <Stack direction="row" spacing={2}>
                <Paper sx={{ flexBasis: '100%', p: 2 }} variant="outlined">
                    <Typography variant="body2"
                                sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {message.text}
                    </Typography>
                </Paper>
                <Paper sx={{ flexBasis: '100%', p: 2 }} variant="outlined">
                    <Typography variant="body2"
                                sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {message.html}
                    </Typography>
                </Paper>
            </Stack>
            { !!message.errorName &&
                <TableContainer component={Paper} variant="outlined">
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={2} padding="none">
                                    <Alert severity="error">
                                        An exception occurred when sending this message.
                                    </Alert>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell width="25%" component="th" scope="row">Error name</TableCell>
                                <TableCell>{message.errorName}</TableCell>
                            </TableRow>
                            { !!message.errorMessage &&
                                <TableRow>
                                    <TableCell component="th" scope="row">Error message</TableCell>
                                    <TableCell>{message.errorMessage}</TableCell>
                                </TableRow> }
                            { !!message.errorStack &&
                                <TableRow>
                                    <TableCell component="th" scope="row">Stack trace</TableCell>
                                    <TableCell sx={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
                                        {message.errorStack}
                                    </TableCell>
                                </TableRow> }
                            { !!message.errorCause &&
                                <TableRow>
                                    <TableCell component="th" scope="row">Cause</TableCell>
                                    <TableCell sx={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
                                        {JSON.parse(message.errorCause)}
                                    </TableCell>
                                </TableRow> }
                        </TableBody>
                    </Table>
                </TableContainer> }
            <TableContainer component={Paper} variant="outlined">
                <Table>
                    <TableBody>
                        { !!message.messageId &&
                            <TableRow>
                                <TableCell width="25%" component="th" scope="row">Message ID</TableCell>
                                <TableCell>{message.messageId}</TableCell>
                            </TableRow> }
                        { !!message.accepted &&
                            <TableRow>
                                <TableCell component="th" scope="row">Accepted</TableCell>
                                <TableCell>{message.accepted}</TableCell>
                            </TableRow> }
                        { !!message.rejected &&
                            <TableRow>
                                <TableCell component="th" scope="row">Rejected</TableCell>
                                <TableCell>{message.rejected}</TableCell>
                            </TableRow> }
                        { !!message.pending &&
                            <TableRow>
                                <TableCell component="th" scope="row">Pending</TableCell>
                                <TableCell>{message.pending}</TableCell>
                            </TableRow> }
                        { !!message.response &&
                            <TableRow>
                                <TableCell component="th" scope="row">Response</TableCell>
                                <TableCell sx={{ whiteSpace: 'pre-line' }}>
                                    {message.response}
                                </TableCell>
                            </TableRow> }
                    </TableBody>
                </Table>
            </TableContainer>
            { !!logs.length && <DetailedLogs logs={logs} variant="outlined" /> }
        </Stack>
    );
}

export const metadata: Metadata = {
    title: 'E-mail message | Outbox | AnimeCon Volunteer Manager',
};
