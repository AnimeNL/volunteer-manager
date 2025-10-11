// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { SelectElement } from '@proxy/react-hook-form-mui';

import type { PopoverPosition } from '@mui/material/Popover';
import Button from '@mui/material/Button';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import HistoryIcon from '@mui/icons-material/History';
import InfoIcon from '@mui/icons-material/Info';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import Skeleton from '@mui/material/Skeleton';

import type { ScheduleEvent, ScheduleEventMutation, ScheduleMarker, ScheduleResource }
    from '@app/admin/components/Schedule';

import type { EventScheduleHistoryContext } from '@app/api/admin/event/schedule/history/[[...id]]/route';
import { ScheduleContext } from './ScheduleContext';
import { ScheduleHistoryTable } from './ScheduleHistoryTable';
import { Schedule } from '@app/admin/components/Schedule';
import { SettingDialog } from '@app/admin/components/SettingDialog';
import { TimePickerElement } from 'react-hook-form-mui/date-pickers';
import { callApi } from '@lib/callApi';
import { dayjs } from '@lib/DateTime';
import { useWindowHeight } from '@app/admin/lib/useWindowHeight';

/**
 * Background color to issue to markers on the schedule, depending on what they represent.
 */
const kMarkerBackgroundColor = {
    avoid: '#ffe082',
    unavailable: '#eceff1',
    'highlight-demand': '#ffeb3b60',
    'highlight-timeslot': '#76ff0350',
};

/**
 * Props accepted by the <ScheduleImpl> component.
 */
interface ScheduleImplProps {
    /**
     * Whether the volunteer is able to delete history items.
     */
    enableHistoryDelete?: boolean;

    /**
     * Whether users should be linked through to their profile pages in the history dialog.
     */
    enableHistoryProfileLinks?: boolean;

    /**
     * Context that should be provided to the history dialog.
     */
    historyContext: EventScheduleHistoryContext['context'];

    /**
     * Whether the schedule should be displayed in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Default expansion state of each of the sections shown in the schedule. Persists for the user.
     */
    sections: Record<string, boolean>;
}

/**
 * The <ScheduleImpl> component displays the actual volunteering schedule. It uses a scheduling
 * component from our calendar library, and shows all the volunteers and shifts in chronological
 * order. Furthermore, it supports all filtering options elsewhere in the user interface.
 */
export function ScheduleImpl(props: ScheduleImplProps) {
    const { readOnly, sections } = props;

    const context = useContext(ScheduleContext);

    // ---------------------------------------------------------------------------------------------
    // Compose the resources that should be shown on the schedule
    // ---------------------------------------------------------------------------------------------

    const { events, markers, resources } = useMemo(() => {
        const events: ScheduleEvent[] = [];
        const markers: ScheduleMarker[] = [];
        const resources: ScheduleResource[] = [];

        if (!!context.schedule) {
            for (const marker of context.schedule.markers) {
                markers.push({
                    ...marker,
                    background: kMarkerBackgroundColor[marker.type],
                });
            }

            for (const resource of context.schedule.resources) {
                resources.push({
                    ...resource,
                    collapsed: sections[resource.name] ?? resource.collapsed,
                    eventCreation: false,
                    name: `${resource.name} (${resource.children.length})`,
                    originalName: resource.name,
                });
            }

            for (const shift of context.schedule.shifts)
                events.push(shift);
        }

        return { events, markers, resources };

    }, [ context.schedule, sections ])

    const { recentShifts, shifts } = useMemo(() => {
        const recentShifts: { id: number; label: string; color: string }[] = [];
        const shifts: { id: number; label: string; color: string }[] = [];

        if (!!context.schedule) {
            for (const shiftId of context.schedule.metadata.recent) {
                const shift = context.schedule.metadata.shifts.find(v => v.id === shiftId);
                if (!shift)
                    continue;  // the |shift| no longer exists

                recentShifts.push(shift);
            }

            for (const shift of context.schedule.metadata.shifts) {
                if (!context.inclusiveShifts && !shift.localTeam)
                    continue;  // ignore this shift

                shifts.push(shift);
            }
        }

        return { recentShifts, shifts };

    }, [ context.inclusiveShifts, context.schedule ]);

    // ---------------------------------------------------------------------------------------------
    // Interaction: double click -> shift settings dialog
    // ---------------------------------------------------------------------------------------------

    type DialogResolver = undefined | ((mutation?: ScheduleEventMutation) => void);

    const [ dialogEvent, setDialogEvent ] = useState<ScheduleEvent | undefined>();
    const [ dialogResolver, setDialogResolver ] = useState<DialogResolver>();

    const handleSettingDialogClose = useCallback(() => {
        setDialogEvent(undefined);
        if (!!dialogResolver)
            dialogResolver(/* do nothing */);

    }, [ dialogResolver ]);

    const handleSettingDialogDelete = useCallback(async () => {
        if (!dialogEvent || !dialogResolver)
            return { error: <>I forgot which shift was selected, sorry!</> };

        dialogResolver({ delete: true });
        return { close: true } as const;

    }, [ dialogEvent, dialogResolver ]);

    const handleSettingDialogUpdate = useCallback(async (event: ScheduleEvent) => {
        if (!dialogEvent || !dialogResolver)
            return { error: <>I forgot which shift was selected, sorry!</> };

        for (const shift of shifts) {
            if (shift.id !== event.shiftId)
                continue;

            let start = event.start;
            if (dayjs.isDayjs(event.startTime))
                start = event.startTime.toISOString();

            let end = event.end;
            if (dayjs.isDayjs(event.endTime))
                end = event.endTime.toISOString();

            setDialogEvent(undefined);
            dialogResolver({
                update: {
                    ...event,
                    shiftId: shift.id,
                    title: shift.label,
                    color: shift.color,
                    start, end,
                }
            });

            return { close: true } as const;
        }

        return { error: <>You need to select a shift to assign them to!</> };

    }, [ dialogEvent, dialogResolver, shifts ]);

    const handleDoubleClick = useCallback(async (event: ScheduleEvent) => {
        return new Promise<ScheduleEventMutation | undefined>(resolve => {
            setDialogEvent(event);
            setDialogResolver(() => resolve);
        });
    }, [ /* no dependencies */ ]);

    const [ dialogDefaultValues, setDialogDefaultValues ] = useState<Record<string, any>>({ });
    useEffect(() => {
        if (!!dialogEvent) {
            setDialogDefaultValues({
                ...dialogEvent,
                shiftId: dialogEvent.shiftId,
                startTime: dayjs(dialogEvent.start).tz(context.schedule?.timezone),
                endTime: dayjs(dialogEvent.end).tz(context.schedule?.timezone),
            });
        }
    }, [ context.schedule?.timezone, dialogEvent ]);

    // ---------------------------------------------------------------------------------------------
    // Interaction: right click -> history
    // ---------------------------------------------------------------------------------------------

    const [ historyDialogEvent, setHistoryDialogEvent ] = useState<ScheduleEvent | undefined>();

    const handleHistoryDialogClose = useCallback(() => {
        setHistoryDialogEvent(undefined);
    }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------
    // Interaction: right click -> recent shift context menu
    // ---------------------------------------------------------------------------------------------

    type ContextMenuResolver = undefined | ((mutation?: ScheduleEventMutation) => void);

    const [ contextMenuEvent, setContextMenuEvent ] = useState<ScheduleEvent | undefined>();
    const [ contextMenuPosition, setContextMenuPosition ] = useState<PopoverPosition | undefined>();
    const [ contextMenuResolver, setContextMenuResolver ] = useState<ContextMenuResolver>();

    const handleRightClickMenuRemove = useCallback(() => {
        if (!contextMenuEvent || !contextMenuResolver)
            return;

        contextMenuResolver({ delete: true });
        setContextMenuEvent(undefined);

    }, [ contextMenuEvent, contextMenuResolver ]);

    const handleRightClickMenuDetails = useCallback(() => {
        if (!contextMenuEvent || !contextMenuResolver)
            return;

        setContextMenuEvent(undefined);

        handleDoubleClick(contextMenuEvent).then(mutation => {
            if (!!contextMenuResolver)
                contextMenuResolver(mutation);
        });

    }, [ contextMenuEvent, contextMenuResolver, handleDoubleClick ]);

    const handleRightClickMenuHistory = useCallback(() => {
        if (!contextMenuEvent || !contextMenuResolver)
            return;

        setHistoryDialogEvent(contextMenuEvent);

        contextMenuResolver(/* do nothing */);
        setContextMenuEvent(undefined);

    }, [ contextMenuEvent, contextMenuResolver ]);

    const handleRightClickMenuSelect = useCallback((shiftId: number) => {
        if (!contextMenuEvent || !contextMenuResolver)
            return;

        for (const shift of shifts) {
            if (shift.id !== shiftId)
                continue;

            contextMenuResolver({
                update: {
                    ...contextMenuEvent,
                    shiftId: shift.id,
                    title: shift.label,
                    color: shift.color,
                }
            });
        }

        setContextMenuEvent(undefined);

    }, [ contextMenuEvent, contextMenuResolver, shifts ]);

    const handleRightClickMenuClose = useCallback(() => {
        setContextMenuEvent(undefined);
        if (!!contextMenuResolver)
            contextMenuResolver(/* do nothing */);

    }, [ contextMenuResolver ]);

    const handleRightClick = useCallback(
        async (event: ScheduleEvent, domEvent: React.MouseEvent<HTMLElement>) => {
            return new Promise<ScheduleEventMutation | undefined>(resolve => {
                setContextMenuEvent(event);
                setContextMenuPosition({
                    top: domEvent.clientY,
                    left: domEvent.clientX,
                });

                setContextMenuResolver(() => resolve);
            });

        }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------
    // Interaction: Collapse and/or expand resources
    // ---------------------------------------------------------------------------------------------

    const handleExpansionChange = useCallback((resource: ScheduleResource, expanded: boolean) => {
        sections[resource.originalName] = !expanded;
        callApi('post', '/api/auth/settings', {
            'user-admin-schedule-expand-sections': JSON.stringify(sections),
        }).catch(error => {
            console.error(`Unable to store user settings: ${error}`);
        });
    }, [ sections ]);

    // ---------------------------------------------------------------------------------------------

    const windowHeight = useWindowHeight();

    if (!context.schedule || !resources.length) {
        return (
            <Paper sx={{ p: 2 }}>
                <Skeleton animation="wave" height={12} width="91%" />
                <Skeleton animation="wave" height={12} width="98%" />
                <Skeleton animation="wave" height={12} width="93%" />
                <Skeleton animation="wave" height={12} width="85%" />
            </Paper>
        );
    }

    const eventDefaults: Partial<ScheduleEvent> = {
        title: 'Unscheduled',
        color: '#760707',
    };

    let height: number | undefined = undefined;

    // Determine the maximum height of the schedule component, to allow both the horizontal and
    // (when necessary) the vertical scrollbars to be visible at once. However, only enforce a
    // height when this is actually required, based on the number of resources in the schedule.
    if (windowHeight > 450) {
        let estimatedScheduleHeight = /* header= */ 50;
        for (const resource of resources) {
            estimatedScheduleHeight += /* section header= */ 32;
            if (!!resource.children)
                estimatedScheduleHeight += resource.children.length * /* resource =*/ 32;
        }

        // Substract 100 from the `windowHeight` to ensure that the essential UI around the tool
        // is still visible. This isn't an exact number, and the user will have to scroll anyway.
        const maximumScheduleHeight = windowHeight - 100;

        if (estimatedScheduleHeight >= maximumScheduleHeight)
            height = maximumScheduleHeight;
    }

    return (
        <Paper>

            <Schedule min={context.schedule.min} max={context.schedule.max} readOnly={readOnly}
                      events={events} eventDefaults={eventDefaults} eventOverlap={false}
                      onChange={context.processMutation} onRightClick={handleRightClick}
                      onResourceExpansionChange={handleExpansionChange} height={height}
                      onDoubleClick={handleDoubleClick} markers={markers} resources={resources}
                      displayTimezone={context.schedule.timezone} subject="shift" />

            { !!dialogEvent &&
                <SettingDialog title="Select a shift" open delete
                               onClose={handleSettingDialogClose}
                               onDelete={handleSettingDialogDelete}
                               onSubmit={handleSettingDialogUpdate}
                               defaultValues={dialogDefaultValues}>
                    <Grid container>
                        <Grid size={{ xs: 12 }}>
                            <SelectElement name="shiftId" options={shifts} size="small" fullWidth />
                        </Grid>
                        <Grid size={{ xs: 6 }} sx={{ pt: 1, pr: 0.5 }}>
                            <TimePickerElement name="startTime"
                                               inputProps={{ size: 'small', fullWidth: true }} />
                        </Grid>
                        <Grid size={{ xs: 6 }} sx={{ pt: 1, pl: 0.5 }}>
                            <TimePickerElement name="endTime"
                                               inputProps={{ size: 'small', fullWidth: true }} />
                        </Grid>
                    </Grid>
                </SettingDialog> }

            { !!historyDialogEvent &&
                <Dialog open onClose={handleHistoryDialogClose} fullWidth maxWidth="md">
                    <DialogTitle>{historyDialogEvent.title} shift history</DialogTitle>
                    <DialogContent>
                        <ScheduleHistoryTable
                            enableDelete={props.enableHistoryDelete}
                            enableProfileLinks={props.enableHistoryProfileLinks}
                            context={{
                                ...props.historyContext,
                                scheduleId: `${historyDialogEvent.id}`,
                            }} />
                    </DialogContent>
                    <DialogActions sx={{ pt: 0, mr: 1, mb: 0 }}>
                        <Button onClick={handleHistoryDialogClose} variant="text">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog> }

            { !!contextMenuEvent &&
                <Menu open onClose={handleRightClickMenuClose}
                      anchorReference="anchorPosition" anchorPosition={contextMenuPosition}
                      slotProps={{ list: { dense: true } }}>
                    <MenuItem onClick={handleRightClickMenuDetails}>
                        <ListItemIcon>
                            <InfoIcon fontSize="small" />
                        </ListItemIcon>
                        Details…
                    </MenuItem>
                    <MenuItem onClick={handleRightClickMenuHistory}>
                        <ListItemIcon>
                            <HistoryIcon fontSize="small" />
                        </ListItemIcon>
                        History…
                    </MenuItem>
                    { !!contextMenuEvent.shiftId &&
                        <MenuItem component={Link}
                                  href={`./shifts/${contextMenuEvent.shiftId}`} target="_blank">
                            <ListItemIcon>
                                <PendingActionsIcon fontSize="small" />
                            </ListItemIcon>
                            Shift
                        </MenuItem> }
                    <MenuItem onClick={handleRightClickMenuRemove}>
                        <ListItemIcon>
                            <DeleteForeverIcon fontSize="small" />
                        </ListItemIcon>
                        Remove
                    </MenuItem>
                    { recentShifts.length > 0 && <Divider /> }
                    { recentShifts.map(shift =>
                        <MenuItem key={shift.id}
                                  onClick={ () => handleRightClickMenuSelect(shift.id) }>
                            <ListItemIcon>
                                <CompareArrowsIcon fontSize="small" />
                            </ListItemIcon>
                            {shift.label}
                        </MenuItem> )}
                </Menu> }

        </Paper>
    );
}
