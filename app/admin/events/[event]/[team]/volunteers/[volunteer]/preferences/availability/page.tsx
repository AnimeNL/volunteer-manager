// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import FreeCancellationIcon from '@mui/icons-material/FreeCancellation';
import TopicOutlinedIcon from '@mui/icons-material/TopicOutlined';

import { AvailabilityForm } from '../AvailabilityForm';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { FormGrid } from '@app/admin/components/FormGrid';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getAvailabilityTimeslots } from '../getAvailabilityTimeslots';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesAvailability } from '@lib/database';

/**
 * Overview of changes made to the volunteer's availability during an event.
 */
export default async function EventTeamVolunteerPreferencesAvailabilityPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/availability'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    const id = (await props.params).volunteer;

    const dbInstance = db;

    const preferencesAvailabilityJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoinAs('uj');

    const combinedTimingFragment = dbInstance.fragmentWithType('string', 'required').sql`
        CONCAT_WS('-', ${preferencesAvailabilityJoin.availabilityTimingStart},
                       ${preferencesAvailabilityJoin.availabilityTimingEnd})`;

    const volunteer = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(preferencesAvailabilityJoin)
            .on(preferencesAvailabilityJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesAvailabilityJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesAvailabilityJoin.teamId.equals(tUsersEvents.teamId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(preferencesAvailabilityJoin.preferenceVersionUserId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(parseInt(id, /* radix= */ 10)))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            versions: dbInstance.aggregateAsArray({
                version: preferencesAvailabilityJoin.preferenceVersion,
                author: usersJoin.name,
                data: {
                    buildUpTearDown: preferencesAvailabilityJoin.availabilityBuildUpTearDown,
                    exceptions:
                        preferencesAvailabilityJoin.availabilityExceptions.valueWhenNull('[]'),
                    hours: preferencesAvailabilityJoin.availabilityHours,
                    timeslotsStr: preferencesAvailabilityJoin.availabilityTimeslots,
                    timing: combinedTimingFragment,
                    remarks: preferencesAvailabilityJoin.availabilityRemarks,
                },
            }),
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!volunteer)
        notFound();

    volunteer.versions.sort((lhs, rhs) =>
        Temporal.ZonedDateTime.compare(lhs.version!, rhs.version!) * -1);

    const availabilityTimeslots = await getAvailabilityTimeslots(event.id);

    const baseUrl = `/admin/events/${event.slug}/${team.slug}/volunteers`;
    return (
        <>
            <Section icon={ <FreeCancellationIcon color="primary" /> }
                     title="Availability"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Volunteers', href: baseUrl },
                         { label: volunteer.name, href: `${baseUrl}/${id}`, },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Availability' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s availability during {event.shortName}.
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
                    No participation preferences have been shared by {volunteer.name}.
                </Alert> }
            { volunteer.versions.map(({ version, author, data }, index) => {
                const date = version!.toString();
                const title =
                    <><LocalDateTime dateTime={date} format="MMMM Do [at] HH:mm" /> ({author})</>;

                return (
                    <ExpandableSection key={date} defaultExpanded={index === 0}
                                       icon={ <TopicOutlinedIcon /> } title={title}>
                        <FormGrid action={undefined!} defaultValues={data}>
                            <AvailabilityForm includeBuildUp={event.flags.enableBuildUp}
                                              includeTearDown={event.flags.enableTearDown}
                                              includeExceptions={{ open: true }}
                                              readOnly
                                              event={{
                                                  startTime: event.startTime.toString(),
                                                  endTime: event.endTime.toString(),
                                                  timeZone: event.timeZone,
                                              }}
                                              timeslots={{
                                                  limit: 3,
                                                  open: true,
                                                  options: availabilityTimeslots,
                                              }} />
                        </FormGrid>
                    </ExpandableSection>
                );
            }) }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Participation', 'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' },
    { event: 'event' });
