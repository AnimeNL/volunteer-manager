// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import LocalHospitalIcon from '@mui/icons-material/LocalHospital';

import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { VendorSchedule } from './VendorSchedule';
import { VendorTable } from './VendorTable';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationContextWithEventAndTeam } from '../../requireAuthenticationContextWithEventAndTeam';
import db, { tVendors, tVendorsSchedule } from '@lib/database';

import { kVendorTeam } from '@lib/database/Types';

import { updateVendorSchedule } from './VendorActions';

/**
 * The first aid team (normally supporting the Stewards) is responsible for making sure that all our
 * visitors are safe, and any incidents are taken care of.
 */
export default async function EventTeamFirstAidPage(
    props: PageProps<'/admin/events/[event]/[team]/first-aid'>)
{
    const { access, event, team } = await requireAuthenticationContextWithEventAndTeam(props, {
        permission: 'event.vendors',
        operation: 'read',
    });

    if (!team.flags.managesFirstAid)
        notFound();

    const roleSetting = await readSetting('vendor-first-aid-roles') ?? 'First Aid';
    const roles = roleSetting.split(',').map(role => role.trim());

    const vendorsScheduleJoin = tVendorsSchedule.forUseInLeftJoin();

    const dbInstance = db;
    const schedule = await dbInstance.selectFrom(tVendors)
        .leftJoin(vendorsScheduleJoin)
            .on(vendorsScheduleJoin.vendorId.equals(tVendors.vendorId))
                .and(vendorsScheduleJoin.vendorsScheduleDeleted.isNull())
        .where(tVendors.vendorTeam.equals(kVendorTeam.FirstAid))
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

    const canUpdateVendors = access.can('event.vendors', 'update', {
        event: event.slug,
        team: team.slug,
    });

    const action =
        canUpdateVendors ? updateVendorSchedule.bind(null, event.slug, team.slug, 'first-aid')
                         : undefined!;

    return (
        <>
            <Section icon={ <LocalHospitalIcon color="primary" /> } title="First aid"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'First aid' },
                     ]}>
                <SectionIntroduction>
                    Team management for the professional first aiders helping us out with{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <VendorTable event={event.slug} team={kVendorTeam.FirstAid}
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

export const generateMetadata = generateEventMetadataFn('First aid');
