// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import { CommunicationButton } from '@app/admin/components/CommunicationDialog';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Page that displays utilities towards trying out the communication features in the system.
 */
export default function CommunicationPage() {
    return (
        <Section title="Communication">
            <SectionIntroduction>
                This is an example page for the new {'<'}CommunicationButton{'>'} component.
            </SectionIntroduction>
            <Table sx={{ mt: '0px !important' }}>
                <TableHead>
                    <TableRow>
                        <TableCell width="30%">Prompt</TableCell>
                        <TableCell>Demo</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <TableRow>
                        <TableCell>ParticipationReminderPrompt</TableCell>
                        <TableCell>
                            <CommunicationButton title="Remind John to participate"
                                                 language="English"
                                                 promptId="participation-reminder"
                                                 promptParams={{
                                                    eventId: 16,
                                                    teamId: 2,
                                                 }}
                                                 recipientId={1}>
                                Send an e-mail to <strong>John</strong> to invite them to help out
                                with AnimeCon 2027.
                            </CommunicationButton>
                        </TableCell>
                    </TableRow>
                    { /* TODO: Vary <CommunicationButton @badge /> */ }
                </TableBody>
            </Table>
        </Section>
    );
}
