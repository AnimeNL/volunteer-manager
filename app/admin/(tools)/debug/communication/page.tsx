// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PodcastsIcon from '@mui/icons-material/Podcasts';

import { CommunicationIconButton } from '@app/admin/components/CommunicationDialog';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * Server Action that can be used with <CommunicationIconButton> to indicate a successful response.
 */
async function commit(
    scenario: 'close' | 'failure' | 'refresh' | 'success', subject?: string, message?: string)
{
    'use server';

    await new Promise(resolve => setTimeout(resolve, 1000));
    switch (scenario) {
        case 'close':
            return {
                success: true,
                close: true,
            };

        case 'failure':
            return {
                success: false,
                error: 'Something has gone terribly wrong',
            };

        case 'refresh':
            return {
                success: true,
                message: 'The page state has been refreshed',
                refresh: true,
            };

        case 'success':
            return {
                success: true,
                message: 'This is a successful message',
            };
    }
}

/**
 * Page that displays utilities towards trying out the communication features in the system.
 */
export default async function CommunicationPage() {
    await requireAuthentication('admin');

    const commitClose = commit.bind(null, 'close');
    const commitFailure = commit.bind(null, 'failure');
    const commitRefresh = commit.bind(null, 'refresh');
    const commitSuccess = commit.bind(null, 'success');

    return (
        <>
            <Section icon={ <PodcastsIcon color="primary" /> } title="Communication"
                     breadcrumbs={[
                         { label: 'Debug', href: '/admin/debug' },
                         { label: 'Communication' },
                     ]}>
                <SectionIntroduction>
                    Demonstration of the various communications that can be send to volunteers.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <List dense disablePadding>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="ApplicationApprovedPrompt" />
                        <CommunicationIconButton title="Approve Emma's application"
                                                 language="Dutch"
                                                 action={commitSuccess}
                                                 promptId="application-approved"
                                                 promptParams={{
                                                     eventId: 15,
                                                     teamId: 1,
                                                 }}
                                                 recipientId={1}>
                            Send an e-mail to <strong>Emma</strong> about approving their
                            application to help out.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="ApplicationRejectedPrompt" />
                        <CommunicationIconButton title="Reject Doug's application"
                                                 badge="check"
                                                 action={commitClose}
                                                 promptId="application-rejected"
                                                 promptParams={{
                                                     eventId: 15,
                                                     teamId: 1,
                                                 }}
                                                 recipientId={4} language={undefined}>
                            Send an e-mail to <strong>Doug</strong> about rejecting their
                            application to help out.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="EventDatesAnnouncedPrompt" />
                        <CommunicationIconButton title="Announce AnimeCon 2027 dates"
                                                 language="Dutch"
                                                 badge="warning"
                                                 action={commitSuccess}
                                                 promptId="event-dates-announced"
                                                 promptParams={{
                                                     eventId: 15,
                                                     teamId: 1,
                                                 }}
                                                 recipientId={1}>
                            Send a <em>save the date</em> e-mail to <strong>Roger</strong> about
                            AnimeCon 2027.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="EventHotelsAnnouncedPrompt" />
                        <CommunicationIconButton title="Announce hotel information"
                                                 action={commitFailure}
                                                 promptId="event-hotels-announced"
                                                 promptParams={{
                                                     eventId: 15,
                                                     teamId: 1,
                                                 }}
                                                 recipientId={1} language={undefined}>
                            Send an e-mail to <strong>David</strong> about hotel information
                            having been published.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="EventTrainingsAnnouncedPrompt" />
                        <CommunicationIconButton title="Announce training information"
                                                 action={commitSuccess}
                                                 promptId="event-trainings-announced"
                                                 promptParams={{
                                                     eventId: 15,
                                                     teamId: 1,
                                                 }}
                                                 recipientId={1} language={undefined}>
                            Send an e-mail to <strong>Anita</strong> about training information
                            having been published.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="ParticipationCancelledPrompt" />
                        <CommunicationIconButton title="Cancel Anna's participation"
                                                 badge="warning"
                                                 action={commitClose}
                                                 promptId="participation-cancelled"
                                                 promptParams={{
                                                     eventId: 15,
                                                     teamId: 1,
                                                 }}
                                                 recipientId={3} language={undefined}>
                            Send an e-mail to <strong>Anna</strong> about their participation
                            having been cancelled.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="ParticipationReinstatedPrompt" />
                        <CommunicationIconButton title="Reinstate Marvin's participation"
                                                 badge="check"
                                                 action={commitFailure}
                                                 promptId="participation-reinstated"
                                                 promptParams={{
                                                     eventId: 15,
                                                     teamId: 1,
                                                 }}
                                                 recipientId={3} language={undefined}>
                            Send an e-mail to <strong>Marvin</strong> about their participation
                            having been reinstated.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="ParticipationReminderPrompt" />
                        <CommunicationIconButton title="Remind John to participate"
                                                 language="English"
                                                 action={commitSuccess}
                                                 promptId="participation-reminder"
                                                 promptParams={{
                                                     eventId: 16,
                                                     teamId: 2,
                                                 }}
                                                 recipientId={1}>
                            Send an e-mail to <strong>John</strong> to invite them to help out
                            with AnimeCon 2027.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem divider>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="TeamChangePrompt" />
                        <CommunicationIconButton title="Tell Max about the team change"
                                                 badge="warning"
                                                 action={commitRefresh}
                                                 promptId="team-change"
                                                 promptParams={{
                                                     eventId: 16,
                                                     oldTeamId: 1,
                                                     newTeamId: 2,
                                                 }}
                                                 recipientId={1} language={undefined}>
                            Send an e-mail to <strong>Max</strong> about having moved them to a
                            new team.
                        </CommunicationIconButton>
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <EmailOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Multiple prompts" />
                        <CommunicationIconButton
                            title="Update Sagar about AnimeCon 2027"
                            disableSilent
                            action={commitSuccess}
                            prompts={[
                                {
                                    promptId: 'event-dates-announced',
                                    promptParams: {
                                        eventId: 15,
                                        teamId: 1,
                                    },
                                    title: 'Announce festival dates',
                                },
                                {
                                    promptId: 'event-hotels-announced',
                                    promptParams: {
                                        eventId: 15,
                                        teamId: 1,
                                    },
                                    title: 'Announce hotel information',
                                    mostRecentCommunication:
                                    '2026-05-01T20:56:11[Europe/London]',
                                },
                                {
                                    promptId: 'event-trainings-announced',
                                    promptParams: {
                                        eventId: 15,
                                        teamId: 1,
                                    },
                                    title: 'Announce training information',
                                }
                            ]}
                            recipientId={1}
                            language={undefined}>

                            Send an update about AnimeCon 2027 to <strong>Sagar</strong>.

                        </CommunicationIconButton>
                    </ListItem>
                </List>
            </Section>
        </>
    );
}
