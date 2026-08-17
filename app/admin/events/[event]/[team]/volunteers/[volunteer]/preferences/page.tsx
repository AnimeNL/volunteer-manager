// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import { FormGridSection } from '@app/admin/components/FormGridSection';
import { ParticipationForm } from './ParticipationForm';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsersEvents, tUsers } from '@lib/database';

import * as actions from './PreferenceActions';

/**
 * Page that visualises, and for some, makes managable the preferences that the volunteer has shared
 * for the current event. Each kind of preference maintains a "changelog".
 */
export default async function EventTeamVolunteerPreferencesPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    const id = (await props.params).volunteer;

    const context = await db.selectFrom(tUsersEvents)
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
            participation: {
                tshirtFit: tUsersEvents.shirtFit,
                tshirtSize: tUsersEvents.shirtSize,
                includeCreditReel: tUsersEvents.includeCredits,
                includeSocialMedia: tUsersEvents.includeSocials,
            },
        })
        .executeSelectNoneOrOne();
    
    if (!context)
        notFound();

    const { volunteer } = context;

    const participationFn =
        actions.updateParticipationPreferences.bind(null, volunteer.id, event.slug, team.slug);

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
            <Section noHeader>
                Hotel
            </Section>
            <FormGridSection icon={ <SmartToyOutlinedIcon /> } title="Participation"
                             action={participationFn} defaultValues={context.participation}>
                <SectionIntroduction grid>
                     General preferences regarding their participation in {event.shortName}.
                </SectionIntroduction>
                <ParticipationForm />
            </FormGridSection>
            <Section noHeader>
                Refund
            </Section>
            <Section noHeader>
                Training
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Preferences', { user: 'volunteer' }, 'Volunteers', { team: 'team' }, { event: 'event' });
