// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { Suspense } from 'react';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import type { VendorTeam } from '@lib/database/Types';
import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { hasVendorSchedule } from '../../lib/data/vendorData';
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
 * `volunteers.vendor-teams` permission, and shift availability, and renders the placeholder card.
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

    if (!await hasVendorSchedule(event, team))
        notFound();

    const { title } = kVendorPageInfo[team];

    return (
        <CardContent>
            <Typography variant="h6" gutterBottom>
                {title}
            </Typography>
            <Typography variant="body2" color="textSecondary">
                Not yet implemented.
            </Typography>
        </CardContent>
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
                        <Suspense fallback={ <Skeleton variant="text" width={220} /> }>
                            <VendorHeaderDescription params={props.params} />
                        </Suspense>
                    }
                    icon={
                        <Suspense fallback={null}>
                            <VendorHeaderIcon params={props.params} />
                        </Suspense>
                    }
                    title={
                        <Suspense fallback={ <Skeleton variant="text" width={110} /> }>
                            <VendorHeaderTitle params={props.params} />
                        </Suspense>
                    } />
            }>
            <Card>
                <SuspenseReveal
                    fallback={
                        <CardContent>
                            <Skeleton variant="text" width="35%" height={28} />
                            <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                        </CardContent>
                    }>
                    <VendorScheduleContent params={props.params} />
                </SuspenseReveal>
            </Card>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
