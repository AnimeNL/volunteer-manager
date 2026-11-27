// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import Card from '@mui/material/Card';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import type { VendorTeam } from '@lib/database/Types';
import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { VendorScheduleCalendar } from './VendorScheduleCalendar';
import { createScheduleMetadataFn } from '../../lib/generateScheduleMetadata';
import { getVendorSchedule } from '../../lib/data/vendorData';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

import { kAnyTeam } from '@lib/auth/access';
import { kVendorTeam } from '@lib/database/Types';

/**
 * Metadata describing each supported vendor team route.
 */
const kVendorPageInfo: Record<VendorTeam, { description: string; title: string }> = {
    [kVendorTeam.FirstAid]: {
        description: 'On-site schedule for First Aid personnel.',
        title: 'First Aid',
    },
    [kVendorTeam.Security]: {
        description: 'On-site schedule for Security personnel.',
        title: 'Security',
    },
};

/**
 * Validates `team` as a known `VendorTeam` slug, returning `undefined` otherwise.
 */
function parseVendorTeam(team: string): VendorTeam | undefined {
    if (team === kVendorTeam.FirstAid || team === kVendorTeam.Security)
        return team;

    return undefined;
}

/**
 * Streams the leading icon for the vendor team header without blocking the static App Shell.
 */
async function VendorHeaderIcon(props: { params: Promise<{ team: string }> }) {
    const team = parseVendorTeam((await props.params).team);
    return team === kVendorTeam.FirstAid
        ? <LocalHospitalOutlinedIcon />
        : <ShieldOutlinedIcon />;
}

/**
 * Streams the title for the vendor team header without blocking the static App Shell.
 */
async function VendorHeaderTitle(props: { params: Promise<{ team: string }> }) {
    const team = parseVendorTeam((await props.params).team);
    return team ? kVendorPageInfo[team].title : 'Vendors';
}

/**
 * Streams the description for the vendor team header without blocking the static App Shell.
 */
async function VendorHeaderDescription(props: { params: Promise<{ team: string }> }) {
    const team = parseVendorTeam((await props.params).team);
    return team ? kVendorPageInfo[team].description : 'On-site vendor schedule.';
}

/**
 * Authenticates the request behind `<Suspense>`, validates the vendor team parameter,
 * `volunteers.vendor-teams` permission, and shift availability, and renders the vendor schedule
 * calendar.
 */
async function VendorScheduleContent(
    props: { params: Promise<{ event: string; team: string }> })
{
    const { event: eventSlug, team: rawTeam } = await props.params;
    const { access, event } = await requireScheduleAccess(eventSlug);

    const team = parseVendorTeam(rawTeam);
    if (!team)
        notFound();

    if (!access.can('volunteers.vendor-teams', 'read', { event: event.slug, team: kAnyTeam }))
        forbidden();

    const { shifts, vendors } = await getVendorSchedule(event, team);
    if (!shifts.length)
        notFound();

    return (
        <VendorScheduleCalendar
            shifts={shifts}
            startDate={event.startTime.toInstant().toString()}
            timeZone={event.timeZone}
            vendors={vendors} />
    );
}

/**
 * Skeleton placeholder matching the fixed three-day calendar layout while vendor shifts stream.
 */
function VendorScheduleSkeleton() {
    return (
        <Stack spacing={1.5} sx={{ height: 1225, p: 1.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ pl: 6 }}>
                <Skeleton variant="rounded" height={44} sx={{ flex: '1 1 0' }} />
                <Skeleton variant="rounded" height={44} sx={{ flex: '1 1 0' }} />
                <Skeleton variant="rounded" height={44} sx={{ flex: '1 1 0' }} />
            </Stack>
            <Skeleton variant="rounded" height="100%" sx={{ flex: '1 1 auto' }} />
        </Stack>
    );
}

/**
 * Vendor team schedule page for volunteers with `volunteers.vendor-teams` access. Only available
 * when at least one shift is scheduled for the requested vendor team.
 */
export default function ScheduleVendorTeamPage(
    props: PageProps<'/schedule2/[event]/vendors/[team]'>)
{
    return (
        <Page
            header={
                <Header
                    description={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={220} /> }>
                            <VendorHeaderDescription params={props.params} />
                        </SuspenseReveal>
                    }
                    icon={
                        <SuspenseReveal fallback={null}>
                            <VendorHeaderIcon params={props.params} />
                        </SuspenseReveal>
                    }
                    title={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={110} /> }>
                            <VendorHeaderTitle params={props.params} />
                        </SuspenseReveal>
                    } />
            }>
            <Card>
                <SuspenseReveal fallback={ <VendorScheduleSkeleton /> }>
                    <VendorScheduleContent params={props.params} />
                </SuspenseReveal>
            </Card>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn({ vendor: 'team' }, { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
