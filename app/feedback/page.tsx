// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { ExportLayout } from '@app/exports/[slug]/ExportLayout';
import { FeedbackForm } from './FeedbackForm';
import { Privilege } from '@lib/auth/Privileges';
import { Temporal } from '@lib/Temporal';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import db, { tEvents, tRoles, tTeams, tUsersEvents, tUsers } from '@lib/database';
import { RegistrationStatus } from '@lib/database/Types';

/**
 * The <FeedbackPage> component displays the feedback tool that can be used during the event for
 * soliciting feedback from volunteers. The page will automatically determine the right event.
 */
export default async function FeedbackPage() {
    await requireAuthenticationContext({ privilege: Privilege.Feedback });

    const currentTime = Temporal.Now.zonedDateTimeISO('utc');
    const eventSelectionTime = currentTime.subtract({ days: 30 });

    const dbInstance = db;
    const event = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventEndTime.greaterOrEquals(eventSelectionTime))
            .and(tEvents.eventHidden.equals(/* false= */ 0))
        .select({
            id: tEvents.eventId,
            name: tEvents.eventShortName,
        })
        .orderBy(tEvents.eventEndTime, 'asc')
            .limit(1)
        .executeSelectNoneOrOne();

    if (!event)
        notFound();

    const volunteers = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            role: tRoles.roleName,
            team: tTeams.teamName,
        })
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.registrationStatus.in([
                RegistrationStatus.Accepted, RegistrationStatus.Cancelled,
            ]))
        .orderBy('name', 'asc')
        .executeSelectMany();

    return (
        <ExportLayout eventName={event.name}>
            <FeedbackForm volunteers={volunteers} />
        </ExportLayout>
    );
}
