// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import Stack from '@mui/material/Stack';

import { FormGridSection } from '@app/admin/components/FormGridSection';
import { HistoryIconButton } from './HistoryIconButton';
import { HotelForm } from './HotelForm';
import { ParticipationForm } from './ParticipationForm';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { SharedDataIconButton } from './SharedDataIconButton';
import { TrainingForm } from './TrainingForm';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getHotelRooms } from './getHotelRooms';
import { getTrainings } from './getTrainings';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesHotel, tUsersEventsPreferencesParticipation, tUsersEventsPreferencesTraining } from '@lib/database';

import * as actions from './PreferenceActions';

/**
 * Page that visualises, and for some, makes managable the preferences that the volunteer has shared
 * for the current event. Each kind of preference maintains a "changelog".
 */
export default async function EventTeamVolunteerPreferencesPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    const id = (await props.params).volunteer;

    const preferencesHotelJoin = tUsersEventsPreferencesHotel.forUseInLeftJoin();
    const preferencesTrainingJoin = tUsersEventsPreferencesTraining.forUseInLeftJoin();

    const dbInstance = db;
    const context = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsersEventsPreferencesParticipation)
            .on(tUsersEventsPreferencesParticipation.userId.equals(tUsersEvents.userId))
                .and(tUsersEventsPreferencesParticipation.eventId.equals(tUsersEvents.eventId))
                .and(tUsersEventsPreferencesParticipation.preferenceVersionIsLatest.equals(1))
        .leftJoin(preferencesHotelJoin)
            .on(preferencesHotelJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesHotelJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesHotelJoin.preferenceVersionIsLatest.equals(1))
        .leftJoin(preferencesTrainingJoin)
            .on(preferencesTrainingJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesTrainingJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesTrainingJoin.preferenceVersionIsLatest.equals(1))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(parseInt(id, /* radix= */ 10)))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            volunteer: {
                id: tUsers.userId,
                name: tUsers.name,
            },
            hotel: {
                interested: preferencesHotelJoin.hotelInterested,
                roomId: preferencesHotelJoin.hotelRoomId,
                occupants: preferencesHotelJoin.hotelRoomOccupants,
                preferences: preferencesHotelJoin.hotelRoomPreferences,
                checkIn: dbInstance.dateAsString(preferencesHotelJoin.hotelCheckIn),
                checkOut: dbInstance.dateAsString(preferencesHotelJoin.hotelCheckOut),
            },
            participation: {
                includeCreditReel:
                    tUsersEventsPreferencesParticipation.participationIncludeCreditReel,
                includeSocialMedia:
                    tUsersEventsPreferencesParticipation.participationIncludeSocialMedia,
                tshirtFit: tUsersEventsPreferencesParticipation.participationTshirtFit,
                tshirtSize: tUsersEventsPreferencesParticipation.participationTshirtSize,
            },
            training: {
                trainingId: preferencesTrainingJoin.trainingId,
            },
        })
        .executeSelectNoneOrOne();
    
    if (!context)
        notFound();

    const { volunteer } = context;

    const hotelRooms = await getHotelRooms(event.id);
    const trainings = await getTrainings(event.id);

    const canUpdatePreferences =
        access.can('event.volunteers.information', 'update', { event: event.slug, team: team.slug })

    const hotelFn = canUpdatePreferences
        ? actions.updateHotelPreferences.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const participationFn = canUpdatePreferences
        ? actions.updateParticipationPreferences.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const trainingFn = canUpdatePreferences
        ? actions.updateTrainingPreferences.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    return (
        <>
            <Section icon={ <ManageAccountsOutlinedIcon color="primary" /> } title="Preferences"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Volunteers',
                             href: `/admin/events/${event.slug}/${team.slug}/volunteers`,
                         },
                         {
                             label: volunteer.name,
                             href: `/admin/events/${event.slug}/${team.slug}/volunteers/${id}`,
                         },
                         { label: 'Preferences' },
                     ]}>
                <SectionIntroduction>
                    Preferences that {volunteer.name} has shared regarding their participation{' '}
                    in {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                TODO?
            </Section>
            <Section noHeader>
                Availability
            </Section>

            <FormGridSection icon={ <HotelIcon /> } title="Hotel"
                             action={hotelFn} defaultValues={context.hotel}
                             headerAction={
                                 <Stack direction="row" spacing={1}>
                                     <SharedDataIconButton />
                                     <HistoryIconButton href="./preferences/hotel" />
                                 </Stack>
                             }>
                <SectionIntroduction grid>
                    Their interest in an hotel room organised by us.
                </SectionIntroduction>
                <HotelForm rooms={hotelRooms} />
            </FormGridSection>

            <FormGridSection icon={ <SmartToyOutlinedIcon /> } title="Participation"
                             action={participationFn} defaultValues={context.participation}
                             headerAction={
                                <Stack direction="row" spacing={1}>
                                    <SharedDataIconButton />
                                    <HistoryIconButton href="./preferences/participation" />
                                </Stack>
                             }>
                <SectionIntroduction grid>
                    General preferences regarding participating in {event.shortName}.
                </SectionIntroduction>
                <ParticipationForm />
            </FormGridSection>

            <Section noHeader>
                Refund
            </Section>

            <FormGridSection icon={ <HistoryEduIcon /> } title="Training"
                             action={trainingFn} defaultValues={context.training}
                             headerAction={
                                <Stack direction="row" spacing={1}>
                                    <SharedDataIconButton />
                                    <HistoryIconButton href="./preferences/training" />
                                </Stack>
                             }>
                <SectionIntroduction grid>
                    Will they participate in our professional training?
                </SectionIntroduction>
                <TrainingForm trainings={trainings} />
            </FormGridSection>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' }, { event: 'event' });
