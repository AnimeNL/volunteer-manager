// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import FreeCancellationIcon from '@mui/icons-material/FreeCancellation';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import Stack from '@mui/material/Stack';

import { AvailabilityForm } from './AvailabilityForm';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { HistoryIconButton } from './HistoryIconButton';
import { HotelForm } from './HotelForm';
import { ParticipationForm } from './ParticipationForm';
import { PrivacyIconButton } from './PrivacyIconButton';
import { RefundForm } from './RefundForm';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SharedDataIconButton } from './SharedDataIconButton';
import { TrainingForm } from './TrainingForm';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getAvailabilityTimeslots } from './getAvailabilityTimeslots';
import { getHotelRooms } from './getHotelRooms';
import { getTrainings } from './getTrainings';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tRoles, tUsers, tUsersEvents, tUsersEventsPreferencesAvailability,
    tUsersEventsPreferencesHotel, tUsersEventsPreferencesParticipation,
    tUsersEventsPreferencesRefunds, tUsersEventsPreferencesTraining } from '@lib/database';

import * as actions from './PreferenceActions';

/**
 * Displays and allows editing of volunteer preferences for the active event.
 */
export default async function EventTeamVolunteerPreferencesPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    const id = parseInt((await props.params).volunteer, /* radix= */ 10);

    const dbInstance = db;
    const volunteerTeamCount = await dbInstance.selectFrom(tUsersEvents)
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.userId.equals(id))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .selectCountAll()
        .executeSelectOne();

    const preferencesAvailabilityJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();
    const preferencesHotelJoin = tUsersEventsPreferencesHotel.forUseInLeftJoin();
    const preferencesRefundsJoin = tUsersEventsPreferencesRefunds.forUseInLeftJoin();
    const preferencesTrainingJoin = tUsersEventsPreferencesTraining.forUseInLeftJoin();

    const combinedTimingFragment = dbInstance.fragmentWithType('string', 'required').sql`
        CONCAT_WS('-', ${preferencesAvailabilityJoin.availabilityTimingStart},
                       ${preferencesAvailabilityJoin.availabilityTimingEnd})`;

    const context = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsersEventsPreferencesParticipation)
            .on(tUsersEventsPreferencesParticipation.userId.equals(tUsersEvents.userId))
                .and(tUsersEventsPreferencesParticipation.eventId.equals(tUsersEvents.eventId))
                .and(tUsersEventsPreferencesParticipation.preferenceVersionIsLatest.equals(1))
        .leftJoin(preferencesAvailabilityJoin)
            .on(preferencesAvailabilityJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesAvailabilityJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesAvailabilityJoin.teamId.equals(tUsersEvents.teamId))
                .and(preferencesAvailabilityJoin.preferenceVersionIsLatest.equals(1))
        .leftJoin(preferencesHotelJoin)
            .on(preferencesHotelJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesHotelJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesHotelJoin.preferenceVersionIsLatest.equals(1))
        .leftJoin(preferencesRefundsJoin)
            .on(preferencesRefundsJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesRefundsJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesRefundsJoin.preferenceVersionIsLatest.equals(1))
        .leftJoin(preferencesTrainingJoin)
            .on(preferencesTrainingJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesTrainingJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesTrainingJoin.preferenceVersionIsLatest.equals(1))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(id))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            volunteer: {
                id: tUsers.userId,
                name: tUsers.name,

                availabilityEventLimit:
                    tUsersEvents.availabilityEventLimit.valueWhenNull(
                        tRoles.roleAvailabilityEventLimit),
                hotelEligibility:
                    tUsersEvents.hotelEligible.valueWhenNull(
                        tRoles.roleHotelEligible).equals(1),
                trainingEligibility:
                    tUsersEvents.trainingEligible.valueWhenNull(
                        tRoles.roleTrainingEligible).equals(1),
            },
            availability: {
                buildUpTearDown: preferencesAvailabilityJoin.availabilityBuildUpTearDown,
                exceptions: preferencesAvailabilityJoin.availabilityExceptions.valueWhenNull('[]'),
                hours: preferencesAvailabilityJoin.availabilityHours,
                timeslotsStr: preferencesAvailabilityJoin.availabilityTimeslots,
                timing: combinedTimingFragment,
                remarks: preferencesAvailabilityJoin.availabilityRemarks,
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
                dietary: tUsersEventsPreferencesParticipation.participationDietary,
                includeCreditReel:
                    tUsersEventsPreferencesParticipation.participationIncludeCreditReel,
                includeSocialMedia:
                    tUsersEventsPreferencesParticipation.participationIncludeSocialMedia,
                tshirtFit: tUsersEventsPreferencesParticipation.participationTshirtFit,
                tshirtSize: tUsersEventsPreferencesParticipation.participationTshirtSize,
            },
            refunds: {
                accountName: preferencesRefundsJoin.refundAccountName,
                accountIban: preferencesRefundsJoin.refundAccountIban,
                ticketNumber: preferencesRefundsJoin.refundTicketNumber,
            },
            training: {
                trainingId: preferencesTrainingJoin.trainingId,
            },
        })
        .executeSelectNoneOrOne();

    if (!context)
        notFound();

    const { volunteer } = context;

    const availabilityTimeslots = await getAvailabilityTimeslots(event.id);
    const hotelRooms = await getHotelRooms(event.id);
    const trainings = await getTrainings(event.id);

    const step = await readSetting('schedule-time-step-minutes') ?? 15;

    // ---------------------------------------------------------------------------------------------

    const canUpdateRefunds = access.can('event.refunds', { event: event.slug });
    const canUpdatePreferences =
        access.can('event.volunteers.information', 'update', { event: event.slug, team: team.slug });

    const availabilityFn = canUpdatePreferences
        ? actions.updateAvailabilityPreferences.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const hotelFn = canUpdatePreferences
        ? actions.updateHotelPreferences.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const participationFn = canUpdatePreferences
        ? actions.updateParticipationPreferences.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const refundsFn = canUpdateRefunds
        ? actions.updateRefundPreferences.bind(null, volunteer.id, event.slug, team.slug)
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

            <FormGridSection icon={ <FreeCancellationIcon /> } title="Availability" tabs
                             action={availabilityFn} defaultValues={context.availability}
                             headerAction={
                                <Stack direction="row" spacing={1}>
                                    <HistoryIconButton href="./preferences/availability" />
                                </Stack>
                             }>
                <SectionIntroduction grid>
                    Information regarding their availability during {event.shortName}.
                </SectionIntroduction>
                <AvailabilityForm includeBuildUp={event.flags.enableBuildUp}
                                  includeTearDown={event.flags.enableTearDown}
                                  includeExceptions={{ open: false, step }}
                                  readOnly={!canUpdatePreferences}
                                  event={{
                                      startTime: event.startTime.toString(),
                                      endTime: event.endTime.toString(),
                                      timeZone: event.timeZone,
                                  }}
                                  timeslots={{
                                      limit: volunteer.availabilityEventLimit,
                                      options: availabilityTimeslots,
                                  }} />
            </FormGridSection>

            { (event.flags.enableHotel && !!volunteer.hotelEligibility) &&
                <FormGridSection icon={ <HotelIcon /> } title="Hotel"
                                 action={hotelFn} defaultValues={context.hotel}
                                 headerAction={
                                     <Stack direction="row" spacing={1}>
                                         { volunteerTeamCount > 1 && <SharedDataIconButton /> }
                                         <HistoryIconButton href="./preferences/hotel" />
                                     </Stack>
                                 }>
                    <SectionIntroduction grid>
                        Their interest in a hotel room organised by us.
                    </SectionIntroduction>
                    <HotelForm readOnly={!canUpdatePreferences} rooms={hotelRooms} />
                </FormGridSection> }

            <FormGridSection icon={ <SmartToyOutlinedIcon /> } title="Participation"
                             action={participationFn} defaultValues={context.participation}
                             headerAction={
                                <Stack direction="row" spacing={1}>
                                    { volunteerTeamCount > 1 && <SharedDataIconButton /> }
                                    <HistoryIconButton href="./preferences/participation" />
                                </Stack>
                             }>
                <SectionIntroduction grid>
                    General preferences regarding participating in {event.shortName}.
                </SectionIntroduction>
                <ParticipationForm readOnly={!canUpdatePreferences} />
            </FormGridSection>

            { (event.flags.enableRefunds && canUpdateRefunds) &&
                <FormGridSection icon={ <MonetizationOnIcon /> } title="Refunds"
                                 action={refundsFn} defaultValues={context.refunds}
                                 headerAction={
                                     <Stack direction="row" spacing={1}>
                                         <PrivacyIconButton />
                                         { volunteerTeamCount > 1 && <SharedDataIconButton /> }
                                         <HistoryIconButton href="./preferences/refunds" />
                                     </Stack>
                                 }>
                    <SectionIntroduction grid>
                        {volunteer.name}'s refund request for a {event.shortName} ticket.
                    </SectionIntroduction>
                    <RefundForm readOnly={!canUpdateRefunds} />
                </FormGridSection> }

            { (event.flags.enableTraining && !!volunteer.trainingEligibility) &&
                <FormGridSection icon={ <HistoryEduIcon /> } title="Training"
                                 action={trainingFn} defaultValues={context.training}
                                 headerAction={
                                     <Stack direction="row" spacing={1}>
                                         { volunteerTeamCount > 1 && <SharedDataIconButton /> }
                                         <HistoryIconButton href="./preferences/training" />
                                     </Stack>
                                 }>
                    <SectionIntroduction grid>
                        Will they participate in our training session?
                    </SectionIntroduction>
                    <TrainingForm readOnly={!canUpdatePreferences} trainings={trainings} />
                </FormGridSection> }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' }, { event: 'event' });
