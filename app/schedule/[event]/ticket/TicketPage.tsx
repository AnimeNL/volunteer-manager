// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ErrorCard } from '../components/ErrorCard';
import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { QrCode } from '@components/QrCode';
import { ScheduleContext } from '../ScheduleContext';
import { SetTitle } from '../components/SetTitle';

/**
 * The <TicketPage> component displays the signed in volunteer's event ticket as a scannable QR
 * code. All data is sourced from the schedule context.
 */
export function TicketPage() {
    const { schedule } = useContext(ScheduleContext);

    if (!schedule)
        return undefined;  // the page is still loading

    if (!schedule.ticketBarcode) {
        return (
            <>
                <SetTitle title="Ticket" />
                <ErrorCard title="No ticket available">
                    No ticket has been issued to your account for {schedule.event} yet.
                </ErrorCard>
            </>
        );
    }

    return (
        <>
            <SetTitle title="Ticket" />
            <HeaderSectionCard>
                <CardHeader title="Your ticket"
                            subheader={
                                `Show this QR code at the entrance to check in for ` +
                                `${schedule.event}.`
                            }
                            slotProps={{ title: { variant: 'subtitle2' } }}
                            avatar={
                                <ConfirmationNumberOutlinedIcon />
                            } />
            </HeaderSectionCard>
            <Card>
                <CardContent>
                    <Stack direction="column" spacing={2} sx={{ alignItems: 'center', py: 1 }}>
                        <Box sx={{ width: '100%', maxWidth: 320 }}>
                            <QrCode content={schedule.ticketBarcode} />
                        </Box>
                        <Typography variant="body2" sx={{
                            color: 'text.secondary',
                            fontFamily: 'monospace',
                            letterSpacing: 1,
                        }}>
                            {schedule.ticketBarcode}
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        </>
    );
}
