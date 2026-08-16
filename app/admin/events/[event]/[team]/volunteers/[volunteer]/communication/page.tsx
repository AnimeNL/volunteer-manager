// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import Stack from '@mui/material/Stack';

import { CommunicationCell } from '../../CommunicationCell';
import { DataTable, createDataSource, kEventTransformer, kTeamTransformer, withContext,
    withRowModel, type Column, type ExtractRowModel } from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { isBefore } from '@lib/Temporal';
import { requireAuthenticationContextWithEventAndTeam } from '../../../../requireAuthenticationContextWithEventAndTeam';
import db, { tOutboxEmail, tUsers, tUsersCommunication, tUsersEvents } from '@lib/database';

import { sendCommunicationToVolunteer } from './../../VolunteerActions';

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
                check: 'admin',
                permission: {
                    permission: 'event.volunteers.information',
                    operation: 'read',
                    scope: {
                        event: context.event.slug,
                        team: context.team.slug,
                    },
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

            const dbInstance = db;
            const messages = await dbInstance.selectFrom(tUsersCommunication)
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
                    date: dbInstance.dateTimeAsString(tUsersCommunication.communicationDate),
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
    const { access, event, team } = await requireAuthenticationContextWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    const id = (await props.params).volunteer;

    const usersCommunicationJoin = tUsersCommunication.forUseInLeftJoin();

    const dbInstance = db;
    const volunteer = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(usersCommunicationJoin)
            .on(usersCommunicationJoin.userId.equals(tUsersEvents.userId))
                .and(usersCommunicationJoin.communicationEventId.equals(tUsersEvents.eventId))
                .and(usersCommunicationJoin.communicationTeamId.equals(tUsersEvents.teamId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(parseInt(id, /* radix= */ 10)))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            language: tUsers.language,

            communication: dbInstance.aggregateAsArray({
                promptId: usersCommunicationJoin.communicationPromptId,
                date: usersCommunicationJoin.communicationDate,
            }),
        })
        .executeSelectNoneOrOne();

    if (!volunteer)
        notFound();

    // ---------------------------------------------------------------------------------------------
    // Process the communication sent to this user, with a focus on deciding the most recent time
    // a message of a particular type was sent to them.
    // ---------------------------------------------------------------------------------------------

    const communication: Record<string, string> = {};
    const communicationPrompts: Map<string, Temporal.ZonedDateTime> = new Map();
    for (const item of volunteer.communication) {
        const latestCommunication = communicationPrompts.get(item.promptId);
        if (!latestCommunication || isBefore(latestCommunication, item.date))
            communicationPrompts.set(item.promptId, item.date);
    }

    for (const [ promptId, date ] of communicationPrompts.entries())
        communication[promptId] = date.toString();

    // ---------------------------------------------------------------------------------------------

    const canAccessOutbox = access.can('system.internals.outbox');

    const communicationAction = sendCommunicationToVolunteer.bind(null, event.id, team.id);

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
            <Section icon={ <EmailOutlinedIcon /> } title="Send an e-mail">
                <SectionIntroduction>
                    You're most welcome to send {volunteer.firstName} an e-mail. The following
                    button will help you get started.
                </SectionIntroduction>
                <Stack direction="column" sx={{ alignItems: 'center' }}>
                    <CommunicationCell
                        row={{ ...volunteer, communication }}
                        context={{
                            action: sendCommunicationToVolunteer.bind(null, event.id, team.id),
                            eventId: event.id,
                            eventName: event.shortName,
                            size: 'large',
                            teamId: team.id,
                        }} />
                </Stack>
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Communication', { user: 'volunteer' }, 'Volunteers', { team: 'team' }, { event: 'event' });
