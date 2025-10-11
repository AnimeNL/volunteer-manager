// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

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

import { Temporal, formatDate } from '@lib/Temporal';
import { type TwilioOutboxType, kTwilioOutboxType } from '@lib/database/Types';
import db, { tOutboxTwilio, tUsers } from '@lib/database';
import { WebhookDataTable } from '../webhooks/WebhookDataTable';

/**
 * Props accepted by the <TwilioDetailsPage> component.
 */
interface TwilioDetailsPageProps {
    /**
     * Type of message details should be shown for.
     */
    type: TwilioOutboxType;

    /**
     * Unique ID of the message that should be detailed.
     */
    id: number;
}

/**
 * The <TwilioDetailsPage> component displays a detail page listing all information known about a
 * particular Twilio message in the outbox.
 */
export async function TwilioDetailsPage(props: TwilioDetailsPageProps) {
    const recipientUserJoin = tUsers.forUseInLeftJoinAs('ruj');
    const senderUserJoin = tUsers.forUseInLeftJoinAs('suj');

    const dbInstance = db;
    const message = await dbInstance.selectFrom(tOutboxTwilio)
        .leftJoin(senderUserJoin)
            .on(senderUserJoin.userId.equals(tOutboxTwilio.outboxSenderUserId))
        .leftJoin(recipientUserJoin)
            .on(recipientUserJoin.userId.equals(tOutboxTwilio.outboxRecipientUserId))
        .where(tOutboxTwilio.outboxType.equals(props.type))
            .and(tOutboxTwilio.outboxTwilioId.equals(props.id))
        .select({
            date: tOutboxTwilio.outboxTimestamp,
            sender: {
                name: tOutboxTwilio.outboxSender,
                user: {
                    id: senderUserJoin.userId,
                    name: senderUserJoin.name,
                },
            },
            recipient: {
                name: tOutboxTwilio.outboxRecipient,
                user: {
                    id: recipientUserJoin.userId,
                    name: recipientUserJoin.name,
                },
            },
            message: tOutboxTwilio.outboxMessage,
            error: {
                code: tOutboxTwilio.outboxResultErrorCode,
                message: tOutboxTwilio.outboxResultErrorMessage,
            },
            exception: {
                name: tOutboxTwilio.outboxErrorName,
                cause: tOutboxTwilio.outboxErrorCause,
                message: tOutboxTwilio.outboxErrorMessage,
                stack: tOutboxTwilio.outboxErrorStack,
            },
            result: {
                status: tOutboxTwilio.outboxResultStatus,
                sid: tOutboxTwilio.outboxResultSid,
                time: tOutboxTwilio.outboxResultTime,
            },
        })
        .executeSelectNoneOrOne();

    if (!message)
        notFound();

    const accountsBaseUrl = '/admin/organisation/accounts/';

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
                            <TableCell width="25%" component="th" scope="row">
                                From
                            </TableCell>
                            <TableCell>
                                { (!message.sender || !message.sender.name) &&
                                    <Typography sx={{ color: 'text.disabled', fontStyle: 'italic' }}
                                                component="span" variant="body2">
                                        Unknown
                                    </Typography> }

                                { (!!message.sender && !!message.sender.name) &&
                                    <Typography component="span" variant="body2">
                                        {message.sender.name}
                                    </Typography> }

                                { (!!message.sender && !!message.sender.user?.name) &&
                                    ' — on behalf of ' }

                                { (!!message.sender && !!message.sender.user?.name) &&
                                    <MuiLink component={Link}
                                             href={`${accountsBaseUrl}${message.sender.user.id}`}>
                                        {message.sender.user.name}
                                    </MuiLink> }
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">
                                To
                            </TableCell>
                            <TableCell>
                                {message.recipient.name}

                                { !!message.recipient.user && ' — ' }
                                { !!message.recipient.user &&
                                    <MuiLink component={Link}
                                            href={`${accountsBaseUrl}${message.recipient.user.id}`}>
                                        {message.recipient.user.name}
                                    </MuiLink> }
                            </TableCell>
                        </TableRow>
                        { props.type === kTwilioOutboxType.WhatsApp &&
                            <TableRow>
                                <TableCell colSpan={2} padding="none">
                                    <Alert severity="warning" variant="standard">
                                        WhatsApp messages are based on templates, so the message may
                                        not be immediately useful.
                                    </Alert>
                                </TableCell>
                            </TableRow> }
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">
                                Message
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                {message.message}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
            { !!message.error &&
                <TableContainer component={Paper} variant="outlined">
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={2} padding="none">
                                    <Alert severity="error">
                                        An error occurred when sending this message.
                                    </Alert>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell width="25%" component="th" scope="row">
                                    Error code
                                </TableCell>
                                <TableCell>{message.error.code}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell component="th" scope="row">
                                    Error message
                                </TableCell>
                                <TableCell>{message.error.message}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer> }
            { !!message.exception &&
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
                                <TableCell width="25%" component="th" scope="row">
                                    Error name
                                </TableCell>
                                <TableCell>{message.exception.name}</TableCell>
                            </TableRow>
                            { !!message.exception.message &&
                                <TableRow>
                                    <TableCell component="th" scope="row">
                                        Error message
                                    </TableCell>
                                    <TableCell>{message.exception.message}</TableCell>
                                </TableRow> }
                            { !!message.exception.stack &&
                                <TableRow>
                                    <TableCell component="th" scope="row">
                                        Stack trace
                                    </TableCell>
                                    <TableCell sx={{whiteSpace: 'pre-wrap',
                                                    overflowWrap: 'anywhere'}}>
                                        {message.exception.stack}
                                    </TableCell>
                                </TableRow> }
                            { !!message.exception.cause &&
                                <TableRow>
                                    <TableCell component="th" scope="row">
                                        Cause
                                    </TableCell>
                                    <TableCell sx={{whiteSpace: 'pre-wrap',
                                                    overflowWrap: 'anywhere'}}>
                                        { JSON.stringify(
                                            JSON.parse(message.exception.cause),
                                            undefined, 4) }
                                    </TableCell>
                                </TableRow> }
                        </TableBody>
                    </Table>
                </TableContainer> }
            { !!message.result &&
                <TableContainer component={Paper} variant="outlined">
                    <Table>
                        <TableBody>
                            { !!message.result.status &&
                                <TableRow>
                                    <TableCell width="25%" component="th" scope="row">
                                        Status
                                    </TableCell>
                                    <TableCell>{message.result.status}</TableCell>
                                </TableRow> }
                            { !!message.result.sid &&
                                <TableRow>
                                    <TableCell width="25%" component="th" scope="row">
                                        SID
                                    </TableCell>
                                    <TableCell>{message.result.sid}</TableCell>
                                </TableRow> }
                            <TableRow>
                                <TableCell width="25%" component="th" scope="row">
                                    Time
                                </TableCell>
                                <TableCell>{message.result.time}ms</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer> }
            { !!message.result && !!message.result.sid &&
                <WebhookDataTable twilioMessageSid={message.result.sid} /> }
        </Stack>
    );
}
