// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import { CommunicationIconButton } from '@app/admin/components/CommunicationDialog';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

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
export default function CommunicationPage() {
    const commitClose = commit.bind(null, 'close');
    const commitFailure = commit.bind(null, 'failure');
    const commitRefresh = commit.bind(null, 'refresh');
    const commitSuccess = commit.bind(null, 'success');

    return (
        <Section title="Communication">
            <SectionIntroduction>
                This is an example page for the new {'<'}CommunicationIconButton{'>'} component.
            </SectionIntroduction>
            <Table sx={{ mt: '0px !important' }}>
                <TableHead>
                    <TableRow>
                        <TableCell width="30%">Prompt</TableCell>
                        <TableCell>Demo</TableCell>
                        <TableCell>Comments</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <TableRow>
                        <TableCell>ApplicationApprovedPrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ preferred language, successful commit</em>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>ApplicationRejectedPrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ check badge, auto-closes the dialog</em>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>EventDatesAnnouncedPrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ preferred language, warnings badge, successful commit</em>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>EventHotelsAnnouncedPrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ failed commit</em>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>EventTrainingsAnnouncedPrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ successful commit</em>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>ParticipationCancelledPrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ warning badge, auto-closes the dialog</em>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>ParticipationReinstatedPrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ success badge, fails the commit</em>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>ParticipationReminderPrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ preferred language, successful commit</em>
                        </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { borderBottomColor: 'black' } }}>
                        <TableCell>TeamChangePrompt</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ state refresh, successful commit</em>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Multiple prompts</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                            <em>w/ prompt selection, disable silent</em>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </Section>
    );
}
