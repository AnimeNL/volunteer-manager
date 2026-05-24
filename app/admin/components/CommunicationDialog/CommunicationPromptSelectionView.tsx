// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EmailIcon from '@mui/icons-material/Email';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { LocalDateTime } from '../LocalDateTime';

/**
 * Information that can be passed about each prompt to help the dialog make sense.
 */
export interface CommunicationSelectionPrompt {
    /**
     * Date, as a Temporal ZonedDateTime-compatible serialisation, at which the most recent
     * communication of this prompt was distributed. Exclusively for use in the user interface.
     */
    mostRecentCommunication?: string;

    /**
     * Title of the action, will be used instead of the dialog title upon being selected as well.
     */
    title?: string;
}

/**
 * Props accepted by the <CommunicationPromptSelectionView> component.
 */
interface CommunicationPromptSelectionViewProps {
    /**
     * Callback to be invoked when the user has selected which prompt to proceed with.
     */
    onPromptSelected: (promptId: CommunicationPromptId) => void;

    /**
     * Selection of prompts that should be displayed in this view.
     */
    prompts: (CommunicationSelectionPrompt & {
        /**
         * Unique ID of the prompt that should be executed to generate the message.
         */
        promptId: CommunicationPromptId;

    })[];
}

/**
 * The <CommunicationPromptSelectionView> component enables the user to select which prompt they
 * would like to communicate to the user. Some optional metadata is made available.
 */
export function CommunicationPromptSelectionView(props: CommunicationPromptSelectionViewProps) {
    return (
        <List dense disablePadding sx={{ mx: -2, my: -1 }}>
            { props.prompts.map(prompt =>
                <ListItemButton key={prompt.promptId}
                                onClick={ () => props.onPromptSelected(prompt.promptId) }>
                    <ListItemIcon>
                        { prompt.mostRecentCommunication && <MarkEmailReadIcon color="success" /> }
                        { !prompt.mostRecentCommunication && <EmailIcon color="primary" /> }
                    </ListItemIcon>
                    <ListItemText primary={prompt.title ?? prompt.promptId} />
                    { !!prompt.mostRecentCommunication &&
                        <Stack direction="row" spacing={1} sx={{ justifyItems: 'end' }}>
                            <Typography variant="body2" noWrap sx={{ pt: '0.5px' }}>
                                <LocalDateTime dateTime={prompt.mostRecentCommunication}
                                               format="YYYY-MM-DD" />
                            </Typography>
                            <AccessTimeIcon color="primary" fontSize="small" />
                        </Stack> }
                </ListItemButton> )}
        </List>
    );
}
