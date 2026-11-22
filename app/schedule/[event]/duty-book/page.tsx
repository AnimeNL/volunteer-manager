// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { forbidden, redirect } from 'next/navigation';

import BookIcon from '@mui/icons-material/Book';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';
import ReadMoreIcon from '@mui/icons-material/ReadMore';

import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { SetTitle } from '../components/SetTitle';
import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';
import { requireAuthentication } from '../requireAuthentication';
import db, { tEventsTeams, tTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * The <DutyBookIndexPage> redirects the user directly to their team's Duty Book when they have
 * access to a single team, or presents a team picker when they have access to multiple teams.
 */
export default async function DutyBookIndexPage(props: PageProps<'/schedule/[event]/duty-book'>) {
    const { access, event, user } = await requireAuthentication(props);

    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const teams = await db.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
                .and(tTeams.teamFlagEnableDutyBook.equals(/* true= */ 1))
                .and(tTeams.teamDeleted.isNull())
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEventsTeams.eventId))
                .and(usersEventsJoin.teamId.equals(tEventsTeams.teamId))
                .and(usersEventsJoin.userId.equals(user.id))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            name: tTeams.teamName,
            slug: tTeams.teamSlug,
            isMember: usersEventsJoin.userId.isNotNull(),
        })
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    const accessibleTeams = teams.filter(team =>
        team.isMember ||
        access.can('event.duty-book', 'read', { event: event.slug, team: team.slug }));

    if (!accessibleTeams.length)
        forbidden();

    if (accessibleTeams.length === 1)
        redirect(`/schedule/${event.slug}/duty-book/${accessibleTeams[0].slug}`);

    return (
        <>
            <SetTitle title="Duty book" />
            <HeaderSectionCard>
                <CardHeader title="Duty book"
                            subheader="Select a team to view or report incidents in its Duty Book."
                            slotProps={{ title: { variant: 'subtitle2' } }}
                            avatar={ <BookIcon /> } />
            </HeaderSectionCard>
            { accessibleTeams.map(team => (
                <Card key={team.slug}>
                    <CardActionArea LinkComponent={Link}
                                    href={`/schedule/${event.slug}/duty-book/${team.slug}`}>
                        <CardHeader action={ <ReadMoreIcon color="disabled" /> }
                                    avatar={ <BookIcon color="primary" /> }
                                    title={team.name}
                                    subheader={`${event.shortName} incident records`}
                                    slotProps={{ title: { variant: 'subtitle2' } }} />
                    </CardActionArea>
                </Card>
            )) }
        </>
    );
}

export const generateMetadata = generateScheduleMetadataFn([ 'Duty book' ]);
