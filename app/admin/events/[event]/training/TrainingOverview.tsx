// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton from '@mui/material/IconButton';
import ShareIcon from '@mui/icons-material/Share';
import Stack from '@mui/material/Stack';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Table from '@mui/material/Table';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Information about an individual confirmation.
 */
export interface TrainingConfirmation {
    /**
     * Maximum number of people who can participate in this session.
     */
    capacity: number;

    /**
     * Date on which the session will be taking place.
     */
    date: string;

    /**
     * Participants in this session. May be empty.
     */
    participants: {
        /**
         * Full name of the participant.
         */
        name: string;

        /**
         * User ID and team of the participant, when they are a volunteer.
         */
        userId?: number;
        team?: string;

        /**
         * Whether their participation is fully confirmed.
         */
        confirmed: boolean;
    }[];
}

/**
 * Props accepted by the <TrainingOverview> component.
 */
interface TrainingOverviewProps {
    /**
     * Confirmed participation in trainings that can be shown in a tabular view.
     */
    confirmations: TrainingConfirmation[];

    /**
     * Whether a link to the data export tool should be displayed on the page.
     */
    enableExport?: boolean;
}

/**
 * The <TrainingOverview> component, only shown when there are confirmed trainings, displays the
 * final overview tables of who participates in which trainings.
 */
export function TrainingOverview(props: TrainingOverviewProps) {
    const [ totalCount, rows ] = useMemo(() => {
        let totalCount = 0;
        const rows = [];

        for (let index = 0;; ++index) {
            const row = [];

            let count = 0;
            for (const session of props.confirmations) {
                if (session.participants.length > index) {
                    totalCount++;
                    count++;
                }

                row.push({
                    overflow: index >= session.capacity,
                    ...session.participants[index],
                });
            }

            if (!count)
                break;

            rows.push(row);
        }

        return [ totalCount, rows ];

    }, [ props.confirmations ]);

    const router = useRouter();
    const handleExportButton = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        router.push('/admin/organisation/exports/create');
    }, [ router ])

    return (
        <Accordion disableGutters sx={{ mt: '16px !important', '& >:first-child': { mt: 2 } }}>
            <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
                <Stack direction="row" alignItems="center" justifyContent="space-between"
                       spacing={2} sx={{ flexGrow: 1, pr: 2 }}>
                    <Typography variant="h5">
                        Confirmed participation
                        <Typography component="span" variant="h5" color="action.active"
                                    sx={{ pl: 1 }}>
                            ({totalCount})
                        </Typography>
                    </Typography>
                    { !!props.enableExport &&
                        <Tooltip title="Export participation">
                            <IconButton onClick={handleExportButton}>
                                <ShareIcon fontSize="small" />
                            </IconButton>
                        </Tooltip> }
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Table size="small" sx={{ marginTop: '-8px' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell width="50" />
                            { props.confirmations.map((session, index) =>
                                <TableCell key={index} align="center">
                                    { formatDate(
                                        Temporal.ZonedDateTime.from(session.date), 'dddd, MMMM D') }
                                </TableCell> )}
                            <TableCell width="50" />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        { rows.map((row, index) =>
                            <TableRow key={index}>
                                <TableCell sx={{ color: 'text.disabled' }} align="left">
                                    {index + 1}
                                </TableCell>
                                { row.map((participant, index2) => {
                                    if (!participant)
                                        return <TableCell key={index2} />;

                                    const href =
                                        `./${participant.team}/volunteers/${participant.userId}`;

                                    let color: string | undefined = undefined;
                                    if (participant.overflow)
                                        color = 'warning.main';
                                    else if (!participant.confirmed)
                                        color = 'text.disabled';

                                    return (
                                        <TableCell key={index2} align="center">
                                            <Typography variant="body2" sx={{
                                                fontStyle: participant.confirmed ? '' : 'italic',
                                                '& a': { color } }}>

                                                { !participant.userId && participant.name }
                                                { !!participant.userId &&
                                                    <MuiLink component={Link} href={href}>
                                                        {participant.name}
                                                    </MuiLink> }

                                            </Typography>
                                        </TableCell>
                                    );
                                } )}
                                <TableCell sx={{ color: 'text.disabled' }} align="right">
                                    {index + 1}
                                </TableCell>
                            </TableRow> )}
                    </TableBody>
                </Table>
            </AccordionDetails>
        </Accordion>
    );
}
