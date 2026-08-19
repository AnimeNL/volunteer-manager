// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HistoryEduIcon from '@mui/icons-material/HistoryEdu';

import { PreferenceHistory } from '../PreferenceHistory';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TrainingForm } from '../TrainingForm';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getTrainings } from '../getTrainings';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesTraining } from '@lib/database';

/**
 * Displays the change history of volunteer training preferences.
 */
export default async function EventTeamVolunteerPreferencesTrainingPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/training'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    if (!event.flags.enableTraining)
        notFound();

    const id = (await props.params).volunteer;

    const preferencesTrainingJoin = tUsersEventsPreferencesTraining.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoinAs('uj');

    const dbInstance = db;
    const volunteer = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(preferencesTrainingJoin)
            .on(preferencesTrainingJoin.userId.equals(tUsersEvents.userId))
            .and(preferencesTrainingJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(preferencesTrainingJoin.preferenceVersionUserId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(parseInt(id, /* radix= */ 10)))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            versions: dbInstance.aggregateAsArray({
                version: preferencesTrainingJoin.preferenceVersion,
                author: usersJoin.name,
                data: {
                    trainingId: preferencesTrainingJoin.trainingId,
                },
            }),
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!volunteer)
        notFound();

    volunteer.versions.sort((lhs, rhs) =>
        Temporal.ZonedDateTime.compare(lhs.version!, rhs.version!) * -1);

    const trainings = await getTrainings(event.id);

    const baseUrl = `/admin/events/${event.slug}/${team.slug}/volunteers`;
    return (
        <>
            <Section icon={ <HistoryEduIcon color="primary" /> }
                     title="Training preferences"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Volunteers', href: baseUrl },
                         { label: volunteer.name, href: `${baseUrl}/${id}`, },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Training' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s training preferences for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <PreferenceHistory emptyWarning="No training preferences have been shared yet"
                               versions={volunteer.versions}>
                <TrainingForm readOnly trainings={trainings} />
            </PreferenceHistory>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Training', 'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' },
    { event: 'event' });
