// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Markdown } from '@app/schedule/Markdown';

/**
 * Props accepted by the <NotesCard> component.
 */
interface NotesCardProps {
    /**
     * Icon of the note.
     */
    icon: React.ReactNode;

    /**
     * Title of the note. Optional.
     */
    title: string;

    /**
     * Contents of the notes. May contain Markdown.
     */
    notes: string;
}

/**
 * The <NotesCard> component displays a card with a series of notes. The card will be annotated with
 * the "owner" as a given colour, have a title, and the card's description an Markdown.
 */
export function NotesCard(props: NotesCardProps) {
    return (
        <Card sx={{ p: 2 }}>
            <Stack direction="row" spacing={2}>
                <Box sx={{ height: '1em', minWidth: '40px', textAlign: 'center' }}>
                    {props.icon}
                </Box>
                <Box>
                    <Typography variant="subtitle2">
                        {props.title}
                    </Typography>
                    <Markdown defaultVariant="body2">{props.notes}</Markdown>
                </Box>
            </Stack>
        </Card>
    );
}
