// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <KnowledgeQuestionItem> component.
 */
interface KnowledgeQuestionItemProps {
    /**
     * Whether this question should be expanded on initial render (e.g. from `?q=<id>`).
     */
    defaultExpanded?: boolean;

    /**
     * Stable anchor identifier (`contentPath`) for the question.
     */
    id: string;

    /**
     * Question heading displayed in the interactive summary row.
     */
    question: string;
}

/**
 * Expandable Knowledge Base Q&A row rendered inside `<ScheduleList>`. Highlights the expanded
 * answer with a subtle tonal tint and a primary-coloured left accent bar.
 */
export function KnowledgeQuestionItem(
    props: React.PropsWithChildren<KnowledgeQuestionItemProps>)
{
    const { children, defaultExpanded = false, id, question } = props;
    const [ expanded, setExpanded ] = useState<boolean>(defaultExpanded);

    const panelId = `kb-panel-${id}`;

    return (
        <QuestionItemRoot expanded={expanded} id={id}>
            <QuestionSummaryButton
                aria-controls={panelId}
                aria-expanded={expanded}
                onClick={() => setExpanded(current => !current)}>
                <Typography
                    variant="body2"
                    sx={{
                        color: 'text.primary',
                        flex: '1 1 auto',
                        fontWeight: expanded ? 600 : 500,
                        lineHeight: 1.45,
                        minWidth: 0,
                    }}>
                    {question}
                </Typography>
                <QuestionExpandIcon expanded={expanded} fontSize="small" />
            </QuestionSummaryButton>

            <Collapse in={expanded}>
                <Box id={panelId} sx={{ pb: 1.75, pt: 0.25, px: 2 }}>
                    <Box sx={{ borderLeft: 2, borderColor: 'primary.main', pl: 1.5 }}>
                        {children}
                    </Box>
                </Box>
            </Collapse>
        </QuestionItemRoot>
    );
}

/**
 * Individual question container transitioning to a subtle secondary-container tint when expanded.
 */
const QuestionItemRoot = styled(Box, {
    shouldForwardProp: prop => prop !== 'expanded',
})<{ expanded: boolean }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        transition: theme.transitions.create('background-color', {
            duration: theme.transitions.duration.shorter,
        }),
        variants: [
            {
                props: { expanded: true },
                style: {
                    backgroundColor:
                        `color-mix(in srgb, ${palette.secondary.main} 42%, ` +
                        `${palette.background.paper})`,
                },
            },
        ],
    };
});

/**
 * Full-width interactive header button toggling a question's answer panel.
 */
const QuestionSummaryButton = styled(ButtonBase)(({ theme }) => ({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1.5),
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    textAlign: 'left',
    transition: theme.transitions.create('background-color', {
        duration: theme.transitions.duration.shorter,
    }),
    width: '100%',

    '&:hover': {
        backgroundColor: (theme.vars || theme).palette.action.hover,
    },
}));

/**
 * Rotating chevron indicator for expandable Knowledge Base questions.
 */
const QuestionExpandIcon = styled(ExpandMoreIcon, {
    shouldForwardProp: prop => prop !== 'expanded',
})<{ expanded: boolean }>(({ theme }) => ({
    color: (theme.vars || theme).palette.text.secondary,
    flexShrink: 0,
    transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shorter,
    }),

    variants: [
        {
            props: { expanded: true },
            style: {
                transform: 'rotate(180deg)',
            },
        },
    ],
}));
