// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/Check';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import type { GetScheduleResult } from '@app/api/admin/event/schedule/getSchedule';

/**
 * Props accepted by the <ScheduleHighlightDialog> component.
 */
interface ScheduleHighlightDialogProps {
    /**
     * Comma-separated string of the shifts that have been highlighted, if any.
     */
    highlighted?: string;

    /**
     * Whether shifts from other teams should be displayed in the dialog.
     */
    inclusiveShifts?: boolean;

    /**
     * The full set of shifts that should be displayed in the dialog.
     */
    shifts: GetScheduleResult['metadata']['shifts'];

    /**
     * The full set of teams for which shifts are known in the system.
     */
    teams: GetScheduleResult['metadata']['teams'];

    /**
     * Callback that should be invoked when the status for a shift is being changed.
     */
    onChange?: (shiftId: number) => Promise<void>;

    /**
     * Callback that should be invoked when the dialog is requested to be closed.
     */
    onClose?: () => void;
}

/**
 * The <ScheduleHighlightDialog> component displays a dialog with the available shifts that can be
 * highlighted on the schedule. It includes focused metadata to inform the leader of the shifts
 * where additional scheduling work is still expected.
 */
export function ScheduleHighlightDialog(props: ScheduleHighlightDialogProps) {
    const onChange = props.onChange;

    // ---------------------------------------------------------------------------------------------

    const highlightedSet = useMemo(() => {
        return !!props.highlighted ? new Set(props.highlighted.split(',').map(v => parseInt(v, 10)))
                                   : new Set();

    }, [ props.highlighted ]);

    // ---------------------------------------------------------------------------------------------

    const [ isUpdating, setIsUpdating ] = useState<boolean>(false);

    const handleUpdate = useCallback(async (shiftId: number) => {
        setIsUpdating(true);
        try {
            if (!!onChange)
                await onChange(shiftId);

        } catch (error: any) {
            console.error(`Unable to change the highlighted shifts: ${error}`);
        } finally {
            setIsUpdating(false);
        }
    }, [ onChange ]);

    // ---------------------------------------------------------------------------------------------

    return (
        <Dialog open fullWidth onClose={props.onClose}>
            <DialogTitle>
                <Stack direction="row" spacing={2} alignItems="center"
                       justifyContent="space-between">
                    <Typography variant="inherit">
                        Shifts to highlight
                    </Typography>
                    { isUpdating && <CircularProgress color="error" size="1em" /> }
                </Stack>
            </DialogTitle>
            <DialogContent sx={{ px: 0, '&>ul>*': { py: 0.5 } }}>
                <List disablePadding>
                    { props.shifts.map(shift => {
                        if (!shift.localTeam && !props.inclusiveShifts) return undefined;

                        const callback = handleUpdate.bind(null, shift.id);
                        const checked = highlightedSet.has(shift.id);
                        const color = props.teams[shift.team]?.color;

                        return (
                            <ListItemButton key={shift.id} onClick={callback}>
                                <ListItemIcon>
                                    <Switch edge="end" size="small" checked={checked} />
                                </ListItemIcon>
                                <ListItemText
                                    slotProps={{
                                        secondary: {
                                            color: 'textSecondary',
                                            pt: !!props.inclusiveShifts ? 0.25 : 0,
                                        }
                                    }}
                                    primary={
                                        <Stack direction="row" spacing={1}>
                                            <Typography variant="inherit">
                                                {shift.label}
                                            </Typography>
                                            { !!props.inclusiveShifts &&
                                                <Chip label={props.teams[shift.team].label}
                                                      size="small" sx={{
                                                          backgroundColor: color,
                                                          color: 'white'
                                                      }} /> }
                                        </Stack>
                                    }
                                    secondary={shift.warning} />
                                { shift.status === 'error' &&
                                    <ErrorOutlineIcon fontSize="small" color="error" /> }
                                { shift.status === 'warning' &&
                                    <WarningAmberIcon fontSize="small" color="warning" /> }
                                { shift.status === 'complete' &&
                                    <CheckIcon fontSize="small" color="success" /> }
                            </ListItemButton>
                        );
                    } )}
                </List>
            </DialogContent>
            <DialogActions sx={{ pt: 0, mr: 1, mb: 0 }}>
                <Button onClick={props.onClose} variant="text">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
