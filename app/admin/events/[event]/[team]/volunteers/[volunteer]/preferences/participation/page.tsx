// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import { ParticipationForm } from '../ParticipationForm';
import { PreferenceHistory } from '../PreferenceHistory';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsPreferencesParticipation } from '@lib/database';

/**
 * Displays the change history of volunteer participation preferences.
 */
export default async function EventTeamVolunteerPreferencesParticipationPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/participation'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.participation',
        operation: 'read',
    });

    const id = parseInt((await props.params).volunteer, /* radix= */ 10);
    if (!Number.isSafeInteger(id))
        notFound();

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
            .and(tUsersEvents.userId.equals(id))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            versions: dbInstance.aggregateAsArray({
                version: preferencesParticipationJoin.preferenceVersion,
                author: usersJoin.name,
                data: {
                    dietary: preferencesParticipationJoin.participationDietary,
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
                         { label: volunteer.name, href: `${baseUrl}/${id}` },
                         { label: 'Preferences', href: `${baseUrl}/${id}/preferences` },
                         { label: 'Participation' },
                     ]}>
                <SectionIntroduction>
                    Change history of {volunteer.name}'s participation preferences in{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <PreferenceHistory emptyWarning="No participation preferences have been shared yet"
                               versions={volunteer.versions}>
                <ParticipationForm readOnly />
            </PreferenceHistory>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Participation', 'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' },
    { event: 'event' });
