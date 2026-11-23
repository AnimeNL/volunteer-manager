// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import SecurityIcon from '@mui/icons-material/Security';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { VendorSchedule } from './VendorSchedule';
import { VendorTable } from './VendorTable';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tVendors, tVendorsSchedule } from '@lib/database';

import { kVendorTeam } from '@lib/database/Types';

import { updateVendorSchedule } from './VendorActions';

/**
 * Configuration for each supported vendor team.
 */
const kVendorTeams = {
    'first-aid': {
        defaultRole: 'First Aid',
        description: 'professional first aiders',
        icon: <LocalHospitalIcon color="primary" />,
        setting: 'vendor-first-aid-roles',
        teamFlag: 'managesFirstAid',
        title: 'First aid',
        vendorTeam: kVendorTeam.FirstAid,
    },
    'security': {
        defaultRole: 'Security',
        description: 'professional security team',
        icon: <SecurityIcon color="primary" />,
        setting: 'vendor-security-roles',
        teamFlag: 'managesSecurity',
        title: 'Security',
        vendorTeam: kVendorTeam.Security,
    },
} as const;

type VendorTeamSlug = keyof typeof kVendorTeams;

/**
 * Shared server component for managing a vendor team (First Aid or Security) and its schedule.
 */
export async function VendorPage(props: {
    params: Promise<{ event: string; team: string }>;
    vendor: VendorTeamSlug;
}) {
    const config = kVendorTeams[props.vendor];

    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.vendor-teams',
        operation: 'read',
    });

    if (!team.flags[config.teamFlag])
        notFound();

    const roleSetting = await readSetting(config.setting) ?? config.defaultRole;
    const roles = roleSetting.split(',').map(role => role.trim());

    const vendorsScheduleJoin = tVendorsSchedule.forUseInLeftJoin();

    const dbInstance = db;
    const schedule = await dbInstance.selectFrom(tVendors)
        .leftJoin(vendorsScheduleJoin)
            .on(vendorsScheduleJoin.vendorId.equals(tVendors.vendorId))
                .and(vendorsScheduleJoin.vendorsScheduleDeleted.isNull())
        .where(tVendors.vendorTeam.equals(config.vendorTeam))
            .and(tVendors.eventId.equals(event.id))
            .and(tVendors.vendorVisible.equals(/* true= */ 1))
        .select({
            id: tVendors.vendorId,
            name: tVendors.vendorFirstName.concat(' ').concat(tVendors.vendorLastName),
            role: tVendors.vendorRole,
            schedule: dbInstance.aggregateAsArray({
                id: vendorsScheduleJoin.vendorsScheduleId,
                start: dbInstance.dateTimeAsString(vendorsScheduleJoin.vendorsScheduleStart),
                end: dbInstance.dateTimeAsString(vendorsScheduleJoin.vendorsScheduleEnd),
            }),
        })
        .groupBy(tVendors.vendorId)
        .orderBy('name', 'asc')
        .executeSelectMany();

    const canUpdateVendors = access.can('volunteers.vendor-teams', 'update', {
        event: event.slug,
        team: team.slug,
    });

    const action =
        canUpdateVendors ? updateVendorSchedule.bind(null, event.slug, team.slug, props.vendor)
                         : undefined!;

    return (
        <>
            <Section icon={config.icon} title={config.title}
                     documentation="event/vendor-team" limited={!canUpdateVendors}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: config.title },
                     ]}>
                <SectionIntroduction>
                    Team management for the {config.description} helping us out with{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <VendorTable event={event.slug} team={config.vendorTeam}
                             readOnly={!canUpdateVendors} roles={roles} />
            </Section>
            { !!schedule.length &&
                <Section noHeader>
                    <VendorSchedule action={action} roles={roles} schedule={schedule}
                                    readOnly={!canUpdateVendors}
                                    event={{
                                        startTime: event.startTime.toString(),
                                        endTime: event.endTime.toString(),
                                        timezone: event.timeZone,
                                    }} />
                </Section> }
        </>
    );
}
