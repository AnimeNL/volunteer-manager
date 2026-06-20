// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import EmailIcon from '@mui/icons-material/Email';
import Tooltip from '@mui/material/Tooltip';

import type { VolunteerRowModel } from './dataSource';
import { CommunicationIconButton } from '@app/admin/components/CommunicationDialog';
import type { ServerActionResult } from '@lib/serverAction';
import type { CommunicationPromptId } from '@lib/ai/PromptFactory';

/**
 * Cell that serves as the header enabling communication to be initiated.
 */
export function CommunicationHeaderCell() {
    return (
        <Tooltip title="Send them an e-mail?">
            <EmailIcon color="action" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Context expected to be given to the <CommunicationCell> component.
 */
export interface CommunicationCellContext {
    /**
     * Server Action to be invoked when a communication is due to be sent.
     */
    action: (userId: number, promptId: CommunicationPromptId) => Promise<ServerActionResult>;

    /**
     * Unique ID of the event for which a communication can be crafted.
     */
    eventId: number;

    /**
     * Short name of the event to further contextualise the flow.
     */
    eventName: string;

    /**
     * Unique ID of the team for which a communication can be crafted.
     */
    teamId: number;
}

/**
 * Cell that contains a communication button through which the user can be contacted on a variety of
 * topics. Each topic is included as a prompt in the component.
 */
export function CommunicationCell(
    props: { context?: CommunicationCellContext, row: VolunteerRowModel })
{
    const { action, eventId, eventName, teamId } = props.context!;

    return (
        <CommunicationIconButton
            title={`Update ${props.row.firstName} about ${eventName}?`}
            action={action.bind(null, props.row.id)}
            disableSilent
            language={props.row.language}
            recipientId={props.row.id}
            prompts={[
                {
                    promptId: 'event-dates-announced',
                    promptParams: { eventId, teamId },
                    title: 'Announce festival dates',
                    mostRecentCommunication: props.row.communication['event-dates-announced'],
                },
                {
                    promptId: 'event-hotels-announced',
                    promptParams: { eventId, teamId },
                    title: 'Announce hotel availability',
                    mostRecentCommunication: props.row.communication['event-hotels-announced'],
                },
                {
                    promptId: 'event-trainings-announced',
                    promptParams: { eventId, teamId },
                    title: 'Announce training availability',
                    mostRecentCommunication: props.row.communication['event-trainings-announced'],
                }
        ]}>

            Send <strong>{props.row.firstName}</strong> an update about their
            participation in {eventName}.

        </CommunicationIconButton>
    );
}
