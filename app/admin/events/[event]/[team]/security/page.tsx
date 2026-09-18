// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import SecurityIcon from '@mui/icons-material/Security';

import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { VendorSchedule } from '../first-aid/VendorSchedule';
import { VendorTable } from '../first-aid/VendorTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tVendors, tVendorsSchedule } from '@lib/database';

import { kVendorTeam } from '@lib/database/Types';

import { updateVendorSchedule } from '../first-aid/VendorActions';

/**
 * The security team (normally supporting the Stewards) is responsible for the physical security of
 * our visitors and volunteers. They're a vendor team, and therefore not considered volunteers.
 */
export default async function EventTeamSecurityPage(
    props: PageProps<'/admin/events/[event]/[team]/security'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.vendor-teams',
        operation: 'read',
    });

    if (!team.flags.managesFirstAid)
        notFound();

    const roleSetting = await readSetting('vendor-security-roles') ?? 'Security';
    const roles = roleSetting.split(',').map(role => role.trim());

    const vendorsScheduleJoin = tVendorsSchedule.forUseInLeftJoin();

    const dbInstance = db;
    const schedule = await dbInstance.selectFrom(tVendors)
        .leftJoin(vendorsScheduleJoin)
            .on(vendorsScheduleJoin.vendorId.equals(tVendors.vendorId))
                .and(vendorsScheduleJoin.vendorsScheduleDeleted.isNull())
        .where(tVendors.vendorTeam.equals(kVendorTeam.Security))
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
        canUpdateVendors ? updateVendorSchedule.bind(null, event.slug, team.slug, 'security')
                         : undefined!;

    return (
        <>
            <Section icon={ <SecurityIcon color="primary" /> } title="Security"
                     documentation="event/vendor-team" limited={!canUpdateVendors}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Security' },
                     ]}>
                <SectionIntroduction>
                    Team management for the professional security team helping us out with{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <VendorTable event={event.slug} team={kVendorTeam.Security}
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

export const generateMetadata = createGenerateMetadataFn(
    'Security', { team: 'team' }, { event: 'event' });
