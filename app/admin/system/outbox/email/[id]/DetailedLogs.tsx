// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import Typography from '@mui/material/Typography';
import WarningOutlinedIcon from '@mui/icons-material/WarningOutlined';

import type { EmailLoggerSeverity } from '@lib/integrations/email/EmailLogger';
import type { TaskLogSeverity } from '@lib/scheduler/TaskContext';

/**
 * Detailed logs applicable to outbox messages.
 */
interface DetailedOutboxLogEntry {
    severity: EmailLoggerSeverity;
    params: any[];
};

/**
 * Detailed logs applicable to tasks.
 */
interface DetailedTaskLogEntry {
    severity: TaskLogSeverity;
    data: any[];
    message: string;
};

/**
 * Detailed log type describing all sorts of details.
 */
type DetailedLogEntry = {
    time: number;
} & (DetailedOutboxLogEntry | DetailedTaskLogEntry);

/**
 * Displays an icon appropriate to the severity level of a log message.
 */
function LogSeverity(props: { severity: EmailLoggerSeverity | TaskLogSeverity }) {
    let icon: React.ReactNode = undefined;

    switch (props.severity) {
        case 'trace':
        case 'debug':
        case 'Debug':
            icon = <CircleOutlinedIcon color="action" />;
            break;

        case 'info':
        case 'Info':
            icon = <InfoOutlinedIcon color="info" />;
            break;

        case 'warn':
        case 'Warning':
            icon = <WarningOutlinedIcon color="warning" />;
            break;

        case 'error':
        case 'Error':
        case 'Exception':
        case 'fatal':
            icon = <ErrorOutlinedIcon color="error" />;
            break;
    }

    if (!icon)
        return props.severity;

    return <Tooltip title={props.severity}>{icon}</Tooltip>;
}

/**
 * Displays the time offset nicely formatted, relative to the starting time.
 */
function LogTime(props: { time: number }) {
    return (
        <Typography variant="body2" sx={{ color: 'success.main' }}>
            +{Math.round(props.time/10)/100}s
        </Typography>
    );
}

/**
 * Props accepted by the <DetailedLogs> component.
 */
interface DetailedLogsProps {
    /**
     * The log entries that should be displayed in this component.
     */
    logs: DetailedLogEntry[];

    /**
     * Presentation expected for the paper. Defaults to "elevation".
     */
    variant?: 'elevation' | 'outlined';
}

/**
 * Displays an expandable table displaying the detailed logs of an execution that don't have to be
 * visible by default. Shared across multiple pages.
 */
export function DetailedLogs(props: DetailedLogsProps) {
    return (
        <Paper variant={ props.variant ?? 'elevation' }>
            <Accordion>
                <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <TroubleshootIcon color="info" />
                        <Typography variant="body1">
                            Detailed logs
                        </Typography>
                    </Stack>
                </AccordionSummary>
                <AccordionDetails>
                    <Table sx={{ mt: -2 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell component="th" width="100" align="center">
                                    <strong>Severity</strong>
                                </TableCell>
                                <TableCell component="th" width="100" align="center">
                                    <strong>Time</strong>
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'pre-line' }}>
                                    <strong>Details</strong>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { props.logs.map((log: any, index: number) =>
                                <TableRow key={index}>
                                    <TableCell align="center">
                                        <LogSeverity severity={log.severity} />
                                    </TableCell>
                                    <TableCell align="center">
                                        <LogTime time={log.time} />
                                    </TableCell>
                                    { !!log.params &&
                                        <TableCell sx={{ whiteSpace: 'pre-wrap',
                                                         overflowWrap: 'anywhere' }}>
                                            {JSON.stringify(log.params)}
                                        </TableCell> }
                                    { !!log.message &&
                                        <TableCell>
                                            {log.message}
                                            { (!!log.data && log.data.length > 4) &&
                                                <Box sx={{ whiteSpace: 'pre-wrap',
                                                           overflowWrap: 'anywhere' }}>
                                                    {log.data}
                                                </Box> }
                                        </TableCell> }
                                </TableRow> )}
                        </TableBody>
                    </Table>
                </AccordionDetails>
            </Accordion>
        </Paper>
    );
}
