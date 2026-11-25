// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';

import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Authenticates the request behind `<Suspense>` and renders the placeholder hotel room content.
 */
async function HotelContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    await requireScheduleAccess(eventSlug);

    return (
        <Paper sx={{ p: 2 }}>
            Page content goes here.
        </Paper>
    );
}

/**
 * Hotel room page for the schedule portal.
 */
export default function ScheduleHotelPage(props: PageProps<'/schedule2/[event]/hotel'>) {
    return (
        <Page
            header={
                <Header icon={ <HotelOutlinedIcon /> }
                        title="Hotel room"
                        description="Your assigned hotel room and weekend stay." />
            }
            title="Hotel room">
            <SuspenseReveal
                fallback={
                    <Paper sx={{ p: 2 }}>
                        <Skeleton variant="text" width="40%" />
                    </Paper>
                }>
                <HotelContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
