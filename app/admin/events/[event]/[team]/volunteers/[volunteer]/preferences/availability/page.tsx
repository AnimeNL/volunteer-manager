// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import FreeCancellationIcon from '@mui/icons-material/FreeCancellation';

import { AvailabilityForm } from '../AvailabilityForm';
import { PreferenceHistory } from '../PreferenceHistory';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getAvailabilityTimeslots } from '../getAvailabilityTimeslots';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesAvailability } from '@lib/database';

/**
 * Displays the change history of volunteer availability preferences.
 */
export default async function EventTeamVolunteerPreferencesAvailabilityPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/availability'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.participation',
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

    const availabilityTimeslots = await getAvailabilityTimeslots(event.id, false);
    const step = await readSetting('schedule-time-step-minutes') ?? 15;

    const baseUrl = `/admin/events/${event.slug}/${team.slug}/volunteers`;
    return (
        <>
            <Section icon={ <FreeCancellationIcon color="primary" /> }
                     title="Availability"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Volunteers', href: baseUrl },
                         { label: volunteer.name, href: `${baseUrl}/${id}` },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Availability' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s availability during {event.shortName}.
                </SectionIntroduction>
            </Section>
            <PreferenceHistory emptyWarning="No availability preferences have been shared yet"
                               versions={volunteer.versions}>
                <AvailabilityForm includeBuildUp={event.flags.enableBuildUp}
                                  includeTearDown={event.flags.enableTearDown}
                                  includeExceptions={{ open: true, step }}
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
            </PreferenceHistory>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Availability', 'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' },
    { event: 'event' });
