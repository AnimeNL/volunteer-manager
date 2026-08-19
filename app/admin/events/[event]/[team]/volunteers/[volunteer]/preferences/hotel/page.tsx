// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HotelIcon from '@mui/icons-material/Hotel';

import { HotelForm } from '../HotelForm';
import { PreferenceHistory } from '../PreferenceHistory';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getHotelRooms } from '../getHotelRooms';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesHotel } from '@lib/database';

/**
 * Overview of changes made to the volunteer's hotel preferences.
 */
export default async function EventTeamVolunteerPreferencesHotelPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/hotel'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    if (!event.flags.enableHotel)
        notFound();

    const id = (await props.params).volunteer;

    const preferencesHotelJoin = tUsersEventsPreferencesHotel.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoinAs('uj');

    const dbInstance = db;
    const volunteer = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(preferencesHotelJoin)
            .on(preferencesHotelJoin.userId.equals(tUsersEvents.userId))
            .and(preferencesHotelJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(preferencesHotelJoin.preferenceVersionUserId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(parseInt(id, /* radix= */ 10)))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            versions: dbInstance.aggregateAsArray({
                version: preferencesHotelJoin.preferenceVersion,
                author: usersJoin.name,
                data: {
                    interested: preferencesHotelJoin.hotelInterested,
                    roomId: preferencesHotelJoin.hotelRoomId,
                    occupants: preferencesHotelJoin.hotelRoomOccupants,
                    preferences: preferencesHotelJoin.hotelRoomPreferences,
                    checkIn: dbInstance.dateAsString(preferencesHotelJoin.hotelCheckIn),
                    checkOut: dbInstance.dateAsString(preferencesHotelJoin.hotelCheckOut),
                },
            }),
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();
    
    if (!volunteer)
        notFound();

    volunteer.versions.sort((lhs, rhs) =>
        Temporal.ZonedDateTime.compare(lhs.version!, rhs.version!) * -1);

    const hotelRooms = await getHotelRooms(event.id);

    const baseUrl = `/admin/events/${event.slug}/${team.slug}/volunteers`;
    return (
        <>
            <Section icon={ <HotelIcon color="primary" /> }
                     title="Hotel preferences"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Volunteers', href: baseUrl },
                         { label: volunteer.name, href: `${baseUrl}/${id}`, },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Hotel' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s hotel preferences for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <PreferenceHistory emptyWarning="No hotel preferences have been shared yet"
                               versions={volunteer.versions}>
                <HotelForm readOnly rooms={hotelRooms} />
            </PreferenceHistory>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Hotel', 'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' },
    { event: 'event' });
