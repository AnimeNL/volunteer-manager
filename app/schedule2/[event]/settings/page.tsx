// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { TimeOffsetForm } from './TimeOffsetForm';
import { formatDate } from '@lib/Temporal';
import { readUserSettings } from '@lib/UserSettings';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Authenticates the request behind `<Suspense>`, enforces `event.settings` permission, and renders
 * the developer-only settings controls.
 */
async function SettingsContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { access, currentTime, event, user } = await requireScheduleAccess(eventSlug);
    if (!access.can('event.settings', { event: event.slug }))
        forbidden();

    const userSettings = await readUserSettings(
        user.id, [ 'user-schedule-time-offset-seconds' ], /* disableFallback= */ true);

    const hasOverride = typeof userSettings['user-schedule-time-offset-seconds'] === 'number';
    const initialDateTime = formatDate(currentTime, 'YYYY-MM-DD[T]HH:mm');

    return (
        <TimeOffsetForm
            key={`${hasOverride}:${initialDateTime}`}
            eventSlug={event.slug}
            hasOverride={hasOverride}
            initialDateTime={initialDateTime}
            timeZone={event.timeZone} />
    );
}

/**
 * Skeleton placeholder matching the developer settings card while auth and settings stream.
 */
function SettingsSkeleton() {
    return (
        <Stack spacing={2}>
            <Stack spacing={0.5}>
                <Skeleton variant="text" width={180} height={28} />
                <Skeleton variant="text" width="75%" height={20} />
            </Stack>
            <Skeleton variant="rounded" height={40} />
            <Stack direction="row" spacing={1}>
                <Skeleton variant="rounded" width={72} height={31} />
                <Skeleton variant="rounded" width={72} height={31} />
            </Stack>
        </Stack>
    );
}

/**
 * Developer settings page for the schedule portal.
 */
export default function ScheduleSettingsPage(props: PageProps<'/schedule2/[event]/settings'>) {
    return (
        <Page
            header={
                <Header
                    description="Developer-only overrides for testing the schedule portal."
                    icon={ <SettingsOutlinedIcon /> }
                    title="Developer settings" />
            }>
            <Card>
                <CardContent>
                    <SuspenseReveal fallback={ <SettingsSkeleton /> }>
                        <SettingsContent params={props.params} />
                    </SuspenseReveal>
                </CardContent>
            </Card>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
