// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import TopicOutlinedIcon from '@mui/icons-material/TopicOutlined';

import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { FormGrid } from '@app/admin/components/FormGrid';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { ParticipationForm } from '../ParticipationForm';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesParticipation } from '@lib/database';

/**
 * Page that visualises, and for some, makes managable the preferences that the volunteer has shared
 * for the current event. Each kind of preference maintains a "changelog".
 */
export default async function EventTeamVolunteerPreferencesParticipationPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/participation'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    const id = (await props.params).volunteer;

    const preferencesParticipationJoin = tUsersEventsPreferencesParticipation.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoinAs('uj');

    const dbInstance = db;
    const volunteer = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(preferencesParticipationJoin)
            .on(preferencesParticipationJoin.userId.equals(tUsersEvents.userId))
            .and(preferencesParticipationJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(preferencesParticipationJoin.preferenceVersionUserId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(parseInt(id, /* radix= */ 10)))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            versions: dbInstance.aggregateAsArray({
                version: preferencesParticipationJoin.preferenceVersion,
                author: usersJoin.name,
                data: {
                    includeCreditReel: preferencesParticipationJoin.participationIncludeCreditReel,
                    includeSocialMedia:
                        preferencesParticipationJoin.participationIncludeSocialMedia,
                    tshirtFit: preferencesParticipationJoin.participationTshirtFit,
                    tshirtSize: preferencesParticipationJoin.participationTshirtSize,
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
            <Section icon={ <SmartToyOutlinedIcon color="primary" /> }
                     title="Participation preferences"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Volunteers', href: baseUrl },
                         { label: volunteer.name, href: `${baseUrl}/${id}`, },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Participation' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s participation preferences in{' '}
                    {event.shortName}.
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
                            <ParticipationForm readOnly />
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
