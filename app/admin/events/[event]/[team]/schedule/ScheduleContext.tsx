// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import { createContext, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';

import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PeopleIcon from '@mui/icons-material/People';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';

import type { ChangeEventContext, ScheduleEvent } from '@app/admin/components/Schedule';
import type { GetScheduleResult } from '@app/api/admin/event/schedule/getSchedule';
import type { PageInfoWithTeam } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { DocumentationButton } from '@app/admin/components/DocumentationButton';
import { SectionHeader } from '@app/admin/components/SectionHeader';
import { Temporal, formatDate } from '@lib/Temporal';
import { callApi } from '@lib/callApi';
import { ScheduleHighlightDialog } from './ScheduleHighlightDialog';

/**
 * Information regarding the schedule context.
 */
export interface ScheduleInfo {
    /**
     * Whether it should be possible to schedule shifts owned by the other teams.
     */
    inclusiveShifts: boolean;

    /**
     * Processes the mutation described in the given `context`. Will be `undefined` when the
     * schedule context has not been initialised yet.
     */
    processMutation?: (events: ScheduleEvent[], change: ChangeEventContext) => void;

    /**
     * The schedule, as it was retrieved from the server. Updates periodically.
     */
    schedule?: GetScheduleResult;
}

/**
 * Export the context through which schedule settings will be managed. Settings will persist across
 * browsing sessions for the signed in user.
 */
export const ScheduleContext = createContext<ScheduleInfo>({
    inclusiveShifts: false,
});

/**
 * Fetcher used to retrieve the schedule from the server.
 */
const fetcher = (url: string) => fetch(url).then(r => r.json()).then(r => r.schedule);

/**
 * Props accepted by the <ScheduleContextImpl> component.
 */
interface ScheduleContextImplProps {
    /**
     * Information about the event for which the schedule is being shown.
     */
    event: PageInfoWithTeam['event'];

    /**
     * Information about the team for which the schedule is being shown.
     */
    team: PageInfoWithTeam['team'];

    /**
     * Default values that should be set in the context.
     */
    defaultContext: ScheduleInfo & { date?: string; highlightedShifts?: string };
}

/**
 * The <ScheduleContextImpl> component hosts the schedule context, based on which the views that are
 * part of this tool will operate. Visibility of specific days and other teams is part of that.
 */
export function ScheduleContextImpl(props: React.PropsWithChildren<ScheduleContextImplProps>) {
    const { defaultContext } = props;

    // ---------------------------------------------------------------------------------------------

    // Computes the dates that are available within the schedule—based within the event's start and
    // end dates included in `props.event`. Will be represented as a Set of strings.
    const availableDays = useMemo(() => {
        const firstDay = Temporal.ZonedDateTime.from(props.event.startTime).toPlainDate();
        const lastDay = Temporal.ZonedDateTime.from(props.event.endTime).toPlainDate();

        const availableDays: { date: string, label: string }[] = [];

        if (Temporal.PlainDate.compare(firstDay, lastDay) >= 0)
            throw new Error(`Cannot show available dates when ${firstDay} comes before ${lastDay}`);

        let currentDay = firstDay;
        while (Temporal.PlainDate.compare(currentDay, lastDay) <= 0) {
            availableDays.push({
                date: currentDay.toString(),
                label: formatDate(currentDay, 'dddd'),
            });

            currentDay = currentDay.add({ days: 1 });
        }

        return availableDays;

    }, [ props.event ]);

    // ---------------------------------------------------------------------------------------------

    // Initialise the state based on the `props`. The `date` will be validated on initialisation as
    // the setting may be persisted across events.
    const [ inclusiveShifts, setInclusiveShifts ] = useState(defaultContext.inclusiveShifts);
    const [ date, setDate ] = useState<string | undefined>(() => {
        for (const { date } of availableDays) {
            if (date === props.defaultContext.date)
                return date;
        }

        return undefined;
    });

    // Called when the selected `date` has changed. The given `date` may either be a string when a
    // particular button has been selected, or `undefined` when all buttons have been unselected.
    const handleDateChange = useCallback((event: unknown, date?: string) => {
        setDate(date ?? undefined);
        callApi('post', '/api/auth/settings', { 'user-admin-schedule-date': date || '' })
            .catch(error => console.error(`Unable to save a setting: ${error}`))

    }, [ /* no dependencies */ ]);

    // Called when the inclusive shifts setting has changed. This means that shifts from other teams
    // can now be scheduled for volunteers in this team.
    const handleInclusiveShiftsChange = useCallback((event: unknown, inclusiveShifts: boolean) => {
        setInclusiveShifts(!!inclusiveShifts);
        callApi('post', '/api/auth/settings', {
            'user-admin-schedule-inclusive-shifts': inclusiveShifts
        }).catch(error => console.error(`Unable to save a setting: ${error}`))

    }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    const [ highlightedShifts, setHighlightedShifts ] = useState<string | undefined>(
        defaultContext.highlightedShifts);

    // Load the schedule using SWR. The endpoint will be composed based on the props and the date,
    // following which we will acquire the necessary information from the server.
    const { data, error, isLoading, mutate } = useSWR<GetScheduleResult>(() => {
        const endpointParams = new URLSearchParams;
        if (!!date)
            endpointParams.set('date', date);
        if (!!highlightedShifts)
            endpointParams.set('highlights', highlightedShifts);

        const params = endpointParams.toString();
        return `/api/admin/event/schedule/${props.event.slug}/${props.team.slug}?${params}`;

    }, fetcher, {
        keepPreviousData: true,
        refreshInterval: /* ms= */ 15 * 1000,
    });

    // ---------------------------------------------------------------------------------------------

    const [ isProcessingChange, setProcessingChange ] = useState<boolean>(false);
    const [ processingError, setProcessingError ] = useState<string | undefined>();

    // Called when the `change` has been made to the schedule. It will be communicated with the
    // server, after which the fetched schedule will be invalidated.
    const processMutation = useCallback(async (events: unknown, change: ChangeEventContext) => {
        setProcessingChange(true);
        setProcessingError(undefined);
        try {
            let response: { success: boolean; error?: string };
            if ('created' in change) {
                response = await callApi('post', '/api/admin/event/schedule/:event/:team', {
                    event: props.event.slug,
                    team: props.team.slug,
                    shift: {
                        userId: change.created.resource! as number,
                        shiftId: change.created.shiftId,
                        start: change.created.start,
                        end: change.created.end,
                    },
                });
            } else if ('deleted' in change) {
                response = await callApi('delete', '/api/admin/event/schedule/:event/:team/:id', {
                    id: change.deleted.id as any as string[],
                    event: props.event.slug,
                    team: props.team.slug,
                });
            } else if ('updated' in change) {
                response = await callApi('put', '/api/admin/event/schedule/:event/:team/:id', {
                    id: change.updated.id as any as string[],
                    event: props.event.slug,
                    team: props.team.slug,
                    shift: {
                        userId: change.updated.resource! as number,
                        shiftId: change.updated.shiftId,
                        start: change.updated.start,
                        end: change.updated.end,
                    },
                });
            } else {
                throw new Error(`Invalid change given: ${'' + change}`);
            }

            if (!response.success)
                setProcessingError(response.error ?? 'Unable to update the schedule');

        } catch (error: any) {
            setProcessingError(error?.message ?? 'Unable to update the schedule');
        } finally {
            setProcessingChange(false);
            mutate();  // invalidate the `schedule`
        }
    }, [ mutate, props.event.slug, props.team.slug ]);

    // Closes the processing error that's shown, if any.
    const doCloseError = useCallback(() => setProcessingError(undefined), [ /* no dependencies */ ])

    // ---------------------------------------------------------------------------------------------

    const [ highlightDialogOpen, setHighlightDialogOpen ] = useState<boolean>(false);

    const handleHighlightDialogClose = useCallback(() => setHighlightDialogOpen(false), []);
    const handleHighlightDialogOpen = useCallback(() => setHighlightDialogOpen(true), []);

    const handleToggleShiftHighlight = useCallback(async (shiftId: number) => {
        const highlightedShiftIds =
            !!highlightedShifts ? new Set(highlightedShifts.split(',').map(v => parseInt(v, 10)))
                                : new Set();

        highlightedShiftIds.has(shiftId) ? highlightedShiftIds.delete(shiftId)
                                         : highlightedShiftIds.add(shiftId);

        setHighlightedShifts([ ...highlightedShiftIds ].join(','));
        await mutate();  // invalidate the `schedule`

    }, [ highlightedShifts, mutate ]);

    // ---------------------------------------------------------------------------------------------

    // Set of highlighted shifts. Always an instance, only set to the right shifts when at least a
    // single shift has been selected for highlight.
    const highlightedShiftIds =
        !!highlightedShifts ? new Set(highlightedShifts.split(',').map(v => parseInt(v, 10)))
                            : new Set();

    // The schedule context contains our local confirmation, as well as the schedule that has been
    // fetched from the server, when the data is ready. On top of that, we provide utility functions
    // for schedule mutations to be shared back with the server.
    const scheduleContext: ScheduleInfo = useMemo(() => ({
        inclusiveShifts,
        processMutation,
        schedule: data

    }), [ data, inclusiveShifts, processMutation ]);

    return (
        <ScheduleContext.Provider value={scheduleContext}>

            <Stack component={Paper} direction="row" spacing={2} sx={{ px: 2, py: '13px' }}
                   justifyContent="space-between" alignItems="center">
                <SectionHeader title="Schedule" subtitle={props.team.name} sx={{ mb: 0 }} />
                <Stack direction="row" divider={ <Divider orientation="vertical" flexItem /> }
                       spacing={2} alignItems="center">
                    { (!!isLoading || !!isProcessingChange) &&
                        <Tooltip title="The schedule is being updated…">
                            <CircularProgress size={16} sx={{ mr: '2px !important' }} />
                        </Tooltip> }
                    { ((!isLoading && !isProcessingChange) && !error) &&
                        <Tooltip title="The schedule is up to date">
                            <TaskAltIcon fontSize="small" color="success" />
                        </Tooltip> }
                    { ((!isLoading && !isProcessingChange) && !!error) &&
                        <Tooltip title={ error?.message || 'The schedule could not be updated' }>
                            <ErrorOutlineIcon fontSize="small" color="error" />
                        </Tooltip> }
                    <Tooltip title="Allow scheduling other teams' shifts">
                        <FormControlLabel control={ <Switch size="small"
                                                            defaultChecked={inclusiveShifts} /> }
                                          label={ <PeopleIcon fontSize="small" /> }
                                          labelPlacement="start"
                                          onChange={handleInclusiveShiftsChange}
                                          slotProps={{ typography: { sx: { display: 'flex',
                                                                           mr: .5 } } }} />
                    </Tooltip>
                    <Tooltip title="Highlight shifts">
                        <Badge badgeContent={highlightedShiftIds.size} overlap="circular"
                               color="info">
                            <IconButton onClick={handleHighlightDialogOpen}>
                                <PendingActionsIcon fontSize="small" />
                            </IconButton>
                        </Badge>
                    </Tooltip>
                    <ToggleButtonGroup exclusive value={date} size="small"
                                       onChange={handleDateChange} >
                        { availableDays.map(({ date, label }) =>
                            <ToggleButton key={date} value={date}>
                                {label}
                            </ToggleButton> )}
                    </ToggleButtonGroup>
                    <DocumentationButton color="info" size="medium" topic="schedule" />
                </Stack>
            </Stack>

            {props.children}

            { (!!highlightDialogOpen && !!scheduleContext.schedule) &&
                <ScheduleHighlightDialog highlighted={highlightedShifts}
                                         inclusiveShifts={inclusiveShifts}
                                         shifts={scheduleContext.schedule.metadata.shifts}
                                         teams={scheduleContext.schedule.metadata.teams}
                                         onChange={handleToggleShiftHighlight}
                                         onClose={handleHighlightDialogClose} /> }

            <Snackbar autoHideDuration={3000} onClose={doCloseError} open={!!processingError}>
                <Alert severity="error" variant="filled" sx={{ width: '100%' }}>
                    {processingError}
                </Alert>
            </Snackbar>

        </ScheduleContext.Provider>
    );
}
