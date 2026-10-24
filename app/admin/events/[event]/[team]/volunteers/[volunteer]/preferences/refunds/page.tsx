// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

import { PreferenceHistory } from '../PreferenceHistory';
import { RefundForm } from '../RefundForm';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesRefunds } from '@lib/database';

/**
 * Displays the change history of volunteer refund requests.
 */
export default async function EventTeamVolunteerPreferencesRefundsPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/refunds'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(
        props, 'volunteers.refunds');

    if (!event.flags.enableRefunds)
        notFound();

    const id = (await props.params).volunteer;

    const preferencesRefundsJoin = tUsersEventsPreferencesRefunds.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoinAs('uj');

    const dbInstance = db;
    const volunteer = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(preferencesRefundsJoin)
            .on(preferencesRefundsJoin.userId.equals(tUsersEvents.userId))
            .and(preferencesRefundsJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(preferencesRefundsJoin.preferenceVersionUserId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(parseInt(id, /* radix= */ 10)))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            versions: dbInstance.aggregateAsArray({
                version: preferencesRefundsJoin.preferenceVersion,
                author: usersJoin.name,
                data: {
                    accountName: preferencesRefundsJoin.refundAccountName,
                    accountIban: preferencesRefundsJoin.refundAccountIban,
                    ticketNumber: preferencesRefundsJoin.refundTicketNumber,
                },
            }),
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!volunteer)
        notFound();

    volunteer.versions.sort((lhs, rhs) =>
        Temporal.ZonedDateTime.compare(lhs.version!, rhs.version!) * -1);

    const baseUrl = `/admin/events/${event.slug}/${team.slug}/volunteers`;
    return (
        <>
            <Section icon={ <MonetizationOnIcon color="primary" /> }
                     title="Refund requests"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Volunteers', href: baseUrl },
                         { label: volunteer.name, href: `${baseUrl}/${id}` },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Refunds' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s refund requests for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <PreferenceHistory emptyWarning="No refund requests have been made yet"
                               versions={volunteer.versions}>
                <RefundForm readOnly />
            </PreferenceHistory>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Refunds', 'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' },
    { event: 'event' });
