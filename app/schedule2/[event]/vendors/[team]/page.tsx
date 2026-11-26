// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import type { VendorTeam } from '@lib/database/Types';
import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
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
 * Authenticates the request behind `<Suspense>`, validates the vendor team parameter and
 * `volunteers.vendor-teams` permission, and renders the placeholder card.
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

    const { description, title } = kVendorPageInfo[team];
    const icon = team === kVendorTeam.FirstAid
        ? <LocalHospitalOutlinedIcon />
        : <ShieldOutlinedIcon />;

    return (
        <>
            <Header description={description} icon={icon} title={title} />
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Not yet implemented.
                    </Typography>
                </CardContent>
            </Card>
        </>
    );
}

/**
 * Placeholder vendor team schedule page for volunteers with `volunteers.vendor-teams` access.
 */
export default function ScheduleVendorTeamPage(
    props: PageProps<'/schedule2/[event]/vendors/[team]'>)
{
    return (
        <Page>
            <SuspenseReveal
                fallback={
                    <Card>
                        <CardContent>
                            <Skeleton variant="text" width="35%" height={28} />
                            <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                        </CardContent>
                    </Card>
                }>
                <VendorScheduleContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
