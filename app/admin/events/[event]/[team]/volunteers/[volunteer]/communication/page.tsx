// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, kEventTransformer, kTeamTransformer, withContext,
    withRowModel } from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { VolunteerContactSection } from '../VolunteerContactSection';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tOutboxEmail, tUsers, tUsersCommunication, tUsersEvents } from '@lib/database';

/**
 * Data source through which communication sent to a volunteer can be retrieved.
 */
const volunteerCommunicationDataSource = createDataSource('event/team/volunteer/communication',
    withContext({
        /**
         * Event that the volunteer is participating in.
         */
        event: kEventTransformer,

        /**
         * Team that the volunteer is participating in.
         */
        team: kTeamTransformer,

        /**
         * Unique ID of the volunteer to retrieve communication for.
         */
        volunteer: z.number(),

    }), withRowModel({
        /**
         * Unique ID of this communication entry.
         */
        id: z.number(),

        /**
         * Date and time at which the communication was sent, in UTC.
         */
        date: z.string(),

        /**
         * The person who sent the communication.
         */
        sender: z.object({
            id: z.number().optional(),
            name: z.string(),
        }),

        /**
         * The message or subject of the communication.
         */
        message: z.string(),

    }), {
        async authorize(operation, props, context) {
            executeAccessCheck(props.authenticationContext, {
                permission: 'volunteers.participation',
                operation: 'read',
                scope: {
                    event: context.event.slug,
                    team: context.team.slug,
                },
            });
        },

        async list(params, props, context) {
            let sortField: 'date' | 'sender.name' | 'message' = 'date';
            switch (params.sort.field) {
                case 'date':
                case 'message':
                    sortField = params.sort.field as 'date' | 'message';
                    break;

                case 'sender':
                    sortField = 'sender.name';
                    break;
            }

            const messages = await db.selectFrom(tUsersCommunication)
                .innerJoin(tOutboxEmail)
                    .on(tOutboxEmail.outboxCommunicationId.equals(
                        tUsersCommunication.userCommunicationId))
                .innerJoin(tUsers)
                    .on(tUsers.userId.equals(tUsersCommunication.communicationSenderId))
                .where(tUsersCommunication.userId.equals(context.volunteer))
                    .and(tUsersCommunication.communicationEventId.equals(context.event.id))
                    .and(tUsersCommunication.communicationTeamId.equals(context.team.id))
                    .and(
                        tOutboxEmail.outboxSubject.containsInsensitiveIfValue(params.search).or(
                        tUsers.name.containsInsensitiveIfValue(params.search)))
                .select({
                    id: tOutboxEmail.outboxEmailId,
                    date: db.dateTimeAsString(tOutboxEmail.outboxTimestamp),
                    sender: {
                        id: tUsers.userId,
                        name: tUsers.name,
                    },
                    message: tOutboxEmail.outboxSubject,
                })
                .orderBy(sortField, params.sort.direction)
                .limit(params.page.limit)
                    .offset(params.page.offset)
                .executeSelectPage();

            return {
                rowCount: messages.count,
                rows: messages.data,
            };
        },
    });

/**
 * Page that displays communication that has been sent to an individual volunteer in scope of a
 * particular event and team.
 */
export default async function EventTeamVolunteerCommunicationPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/communication'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.participation',
        operation: 'read',
    });

    const id = parseInt((await props.params).volunteer, /* radix= */ 10);
    if (!Number.isSafeInteger(id))
        notFound();

    const volunteer = await db.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(id))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
        })
        .executeSelectNoneOrOne();

    if (!volunteer)
        notFound();

    const canAccessOutbox = access.can('system.internals.outbox');

    const columns: Column<ExtractRowModel<typeof volunteerCommunicationDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
                href: canAccessOutbox ? '/admin/system/outbox/email/{id}' : undefined,
            },
        },
        {
            field: 'sender',
            headerName: 'Sender',
            flex: 1,

            template: 'account',
        },
        {
            field: 'message',
            headerName: 'Subject',
            flex: 2,
        },
    ];

    return (
        <>
            <Section icon={ <OutboxOutlinedIcon color="primary" /> } title="Communication"
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
                         { label: 'Communication' },
                     ]}>
                <SectionIntroduction>
                    Messages we've sent {volunteer.name} regarding their participation in{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable
                    columns={columns}
                    context={{
                        event: event.slug,
                        team: team.slug,
                        volunteer: volunteer.id,
                    }}
                    defaultSort={{ field: 'date', sort: 'desc' }}
                    pageSize={50}
                    source={volunteerCommunicationDataSource}
                    subject="communication"
                    listViewProps={{
                        primaryField: 'message',
                        secondaryTemplate: 'from {sender.name}',
                        dateField: 'date',
                        linkTemplate:
                            canAccessOutbox ? '/admin/system/outbox/email/{id}' : undefined,
                    }} />
            </Section>
            <VolunteerContactSection event={event.id} team={team.id} user={{
                id: volunteer.id,
                name: volunteer.name,
            }} />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Communication', { user: 'volunteer' }, 'Volunteers', { team: 'team' }, { event: 'event' });

