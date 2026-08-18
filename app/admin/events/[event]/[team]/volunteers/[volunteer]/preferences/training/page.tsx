// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import HotelIcon from '@mui/icons-material/Hotel';
import TopicOutlinedIcon from '@mui/icons-material/TopicOutlined';

import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { FormGrid } from '@app/admin/components/FormGrid';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { TrainingForm } from '../TrainingForm';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getTrainings } from '../getTrainings';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesTraining } from '@lib/database';

/**
 * Overview of changes made to the volunteer's training preferences.
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
            <Section icon={ <HotelIcon color="primary" /> }
                     title="Hotel preferences"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Volunteers', href: baseUrl },
                         { label: volunteer.name, href: `${baseUrl}/${id}`, },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Trainings' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s training preferences for {event.shortName}.
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
                    No training preferences have been shared by {volunteer.name}.
                </Alert> }
            { volunteer.versions.map(({ version, author, data }, index) => {
                const date = version!.toString();
                const title =
                    <><LocalDateTime dateTime={date} format="MMMM Do [at] HH:mm" /> ({author})</>;

                return (
                    <ExpandableSection key={date} defaultExpanded={index === 0}
                                       icon={ <TopicOutlinedIcon /> } title={title}>
                        <FormGrid action={undefined!} defaultValues={data}>
                            <TrainingForm readOnly trainings={trainings} />
                        </FormGrid>
                    </ExpandableSection>
                );
            }) }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Training', 'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' },
    { event: 'event' });
