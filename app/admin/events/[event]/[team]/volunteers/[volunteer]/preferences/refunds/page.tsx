// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import TopicOutlinedIcon from '@mui/icons-material/TopicOutlined';

import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { FormGrid } from '@app/admin/components/FormGrid';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { RefundForm } from '../RefundForm';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesRefunds } from '@lib/database';

/**
 * Overview of changes made to the volunteer's refund requests.
 */
export default async function EventTeamVolunteerPreferencesRefundsPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/refunds'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, 'event.refunds');

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
                         { label: volunteer.name, href: `${baseUrl}/${id}`, },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Refunds' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s refund requests for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader back="Back to preferences" tabs>
                <SectionIntroduction>
                    The Volunteer Managers tracks updates made to these preferences for operational
                    purposes, particularly so that team leads can quickly accommodate last-minute
                    schedule adjustments. Please do not engage in any disputes.
                </SectionIntroduction>
            </Section>
            { !volunteer.versions?.length &&
                <Alert severity="warning" variant="outlined">
                    No refund requests have been made by {volunteer.name}.
                </Alert> }
            { volunteer.versions.map(({ version, author, data }, index) => {
                const date = version!.toString();
                const title =
                    <><LocalDateTime dateTime={date} format="MMMM Do [at] HH:mm" /> ({author})</>;

                return (
                    <ExpandableSection key={date} defaultExpanded={index === 0}
                                       icon={ <TopicOutlinedIcon /> } title={title}>
                        <FormGrid action={undefined!} defaultValues={data}>
                            <RefundForm readOnly />
                        </FormGrid>
                    </ExpandableSection>
                );
            }) }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Refunds', 'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' },
    { event: 'event' });
