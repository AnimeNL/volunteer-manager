// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CommunicationCell } from '../CommunicationCell';
import { getEvent, getTeam } from '@lib/cache';
import { processVolunteerCommunication } from '../dataSource';
import db, { tUsers, tUsersCommunication, tUsersEvents } from '@lib/database';

import { sendCommunicationToVolunteer } from '../VolunteerActions';

/**
 * Props accepted by the <VolunteerContactSection> component.
 */
interface VolunteerContactSectionProps {
    /**
     * Unique ID or URL-safe slug of the event the communication would be in scope of.
     */
    event: number | string;

    /**
     * Unique ID or URL-safe slug of the team the communication would be in scope of.
     */
    team: number | string;

    /**
     * Identity of the user whom to send a communication to.
     */
    user: {
        id: number;
        name: string;
    };
}

/**
 * Component through which contact can be conveniently established with a particular volunteer.
 */
export async function VolunteerContactSection(props: VolunteerContactSectionProps) {
    return (
        <Paper sx={{
            backgroundColor: 'backgroundHighlight',
            paddingX: 2,
            paddingY: 1
        }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    You're most welcome to send {props.user.name} an e-mail—use this action to get
                    started.
                </Typography>
                <Divider flexItem orientation="vertical" />
                <Suspense fallback={ <CircularProgress color="inherit" size="24px" /> }>
                    <ContactVolunteerAction {...props} />
                </Suspense>
            </Stack>
        </Paper>
    );
}

/**
 * Action that gathers the necessary data in order to communicate with the volunteer, and, once all
 * data is available, displays a button through which contact can be established.
 */
async function ContactVolunteerAction(props: VolunteerContactSectionProps) {
    const event = await getEvent(props.event);
    const team = await getTeam(props.team);

    if (!event || !team)
        return null;

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
            .and(tUsersEvents.userId.equals(props.user.id))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            language: tUsers.language,

            communication: dbInstance.aggregateAsArray({
                promptId: usersCommunicationJoin.communicationPromptId,
                date: usersCommunicationJoin.communicationDate,
            }),
        })
        .executeSelectNoneOrOne();

    if (!volunteer)
        return null;

    const communication = processVolunteerCommunication(volunteer.communication);

    return (
        <CommunicationCell
            row={{ ...volunteer, communication }}
            context={{
                action: sendCommunicationToVolunteer.bind(null, event.id, team.id),
                color: 'inherit',
                eventId: event.id,
                eventName: event.shortName,
                teamId: team.id,
            }} />
    );
}
