// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';

import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';

import { Calendar, type CalendarEvent } from '@AnimeNL/volunteer-manager-timeline';
import '@AnimeNL/volunteer-manager-timeline/dist/volunteer-manager-timeline.css';

import type { PublicVendorSchedule } from '@app/api/event/schedule/PublicSchedule';
import { currentInstant, currentTimezone } from '../CurrentTime';
import { useIsMobile } from '../lib/useIsMobile';

/**
 * Props accepted by the <CalendarPopover> component.
 */
interface CalendarPopoverProps {
    /**
     * Whether the calendar should be opened.
     */
    open?: boolean;

    /**
     * The schedule that should be displayed on this calendar.
     */
    schedule: PublicVendorSchedule;

    /**
     * Title that should be shown on the popover.
     */
    title: string;

    /**
     * Called when the calendar should be closed.
     */
    onClose?: () => void;
}

/**
 * The <CalendarPopover> component displays a popover element containing a calendar.
 */
export default function CalendarPopover(props: CalendarPopoverProps) {
    const { open, onClose, schedule, title } = props;

    const isMobile = useIsMobile();
    const theme = useTheme();
    const timezone = currentTimezone();

    const { events, min, max } = useMemo(() => {
        const availableColours = [
            '#c9974e', '#925d65', '#6a7b73', '#a87059', '#cea19c',
            '#3288bd', '#154655', '#9e0142', '#66c2a5', '#e6f598'
        ];

        const events: CalendarEvent[] = [];
        let min: Temporal.Instant | undefined;
        let max: Temporal.Instant | undefined;

        let id = 0;
        for (const vendor of schedule) {
            const title = vendor.name;
            const color = availableColours.shift();

            for (const shift of vendor.shifts) {
                const startInstant = Temporal.Instant.fromEpochMilliseconds(shift.start * 1000);
                if (!min || min.epochMilliseconds > startInstant.epochMilliseconds)
                    min = startInstant;

                const endInstant = Temporal.Instant.fromEpochMilliseconds(shift.end * 1000);
                if (!max || max.epochMilliseconds < endInstant.epochMilliseconds)
                    max = endInstant;

                events.push({
                    id: id++,
                    start: startInstant.toString(),
                    end: endInstant.toString(),

                    title,
                    color,
                });
            }
        }

        if (!min || !max)
            min = max = currentInstant();

        return {
            events,
            min: min.toZonedDateTimeISO(timezone).with({ hour: 0, minute: 0, second: 0 })
                .toString({ timeZoneName: 'never' }),
            max: max.toZonedDateTimeISO(timezone).with({ hour: 23, minute: 59, second: 59 })
                .toString({ timeZoneName: 'never' }),
        };
    }, [ schedule, timezone ]);

    return (
        <Dialog open={!!open} onClose={onClose} fullScreen={isMobile} fullWidth maxWidth="md">
            <Stack direction="row" sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <DialogTitle sx={{ pb: 2 }}>
                    {title}
                </DialogTitle>
                <Box sx={{ pr: 2 }}>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </Stack>
            <Calendar displayTimezone={timezone} min={min} max={max} temporal={Temporal}
                      events={events} view={ isMobile ? 'mobile' : 'desktop' }
                      theme={theme.palette.mode} />
        </Dialog>
    );
}
