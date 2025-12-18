// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { VendorSchedule } from './VendorSchedule';
import { VendorTable } from './VendorTable';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { readSetting } from '@lib/Settings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tVendors, tVendorsSchedule } from '@lib/database';

import { kVendorTeam } from '@lib/database/Types';

/**
 * The first aid team (normally supporting the Stewards) is responsible for making sure that all our
 * visitors are safe, and any incidents are taken care of.
 */
export default async function EventTeamFirstAidPage(
    props: PageProps<'/admin/events/[event]/[team]/first-aid'>)
{
    const params = await props.params;

    const { access, event, team } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.vendors',
        operation: 'read',
        scope: {
            event: params.event,
            team: params.team,
        },
    });

    if (!team.flagManagesFirstAid)
        notFound();

    const canUpdateVendors = access.can('event.vendors', 'update', {
        event: params.event,
        team: params.team,
    });

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

    return (
        <>
            <Section title="First aid" subtitle={event.shortName}>
                <SectionIntroduction>
                    This page allows you to manage the <strong>first aid vendor team</strong>, who
                    are responsible for keeping our visitors and volunteers alive and well. We need
                    to know their full name in order to issue a valid ticket, and optionally their
                    t-shirt preferences when it is appropriate to grant one.
                </SectionIntroduction>
                <VendorTable event={event.slug} team={kVendorTeam.FirstAid}
                             readOnly={!canUpdateVendors} roles={roles} />
            </Section>
            { !!schedule.length &&
                <Section noHeader>
                    <VendorSchedule event={event} team={kVendorTeam.FirstAid} roles={roles}
                                    readOnly={!canUpdateVendors} schedule={schedule} />
                </Section> }
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('First aid');
