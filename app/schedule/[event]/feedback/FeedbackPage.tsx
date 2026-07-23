// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AddCommentIcon from '@mui/icons-material/AddComment';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardHeader from '@mui/material/CardHeader';
import ForumIcon from '@mui/icons-material/Forum';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { FeedbackDialog } from '../components/FeedbackDialog';
import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { SetTitle } from '../components/SetTitle';
import { SubHeader } from '../components/SubHeader';
import { TimedAccordionSummary } from '../components/TimedAccordionSummary';
import { formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <FeedbackPage> component.
 */
interface FeedbackPageProps {
    /**
     * Previous feedback given by the signed in user, if any.
     */
    feedback: {
        id: number;
        feedback: {
            date: string;
            text: string;
        };
        response?: {
            author?: string;
            date?: string;
            text?: string;
        };
    }[];

    /**
     * Timezone in which the event takes place, to correctly display local times.
     */
    timezone: string;
}

/**
 * The <FeedbackPage> component lists all feedback given by the signed in user, and allows them to
 * quickly and conveniently file additional feedback that we should (eventually) respond to.
 */
export function FeedbackPage(props: FeedbackPageProps) {
    const router = useRouter();

    const [ feedbackOpen, setFeedbackOpen ] = useState<boolean>(false);

    const openFeedbackDialog = useCallback(() => setFeedbackOpen(true), [ /* no deps */ ]);
    const closeFeedbackDialog = useCallback(() => {
        router.refresh();  // make sure new entries show up in the list
        setFeedbackOpen(false)
    }, [ router ]);

    return (
        <>
            <SetTitle title="Feedback" />
            <HeaderSectionCard>
                <CardHeader title="Feedback"
                            subheader={
                                'Whether it\'s a suggestion, a compliment, or a complaint, your ' +
                                'insights help us improve and we want to hear them. Each of your ' +
                                'submissions will receive a response, and in many cases lead to ' +
                                'changes in how we work. Thank you!'
                            }
                            slotProps={{ title: { variant: 'subtitle2' } }}
                            avatar={
                                <ForumIcon />
                            } />
            </HeaderSectionCard>

            <Button fullWidth startIcon={ <AddCommentIcon /> } variant="contained" color="success"
                    onClick={openFeedbackDialog}>
                Submit feedback
            </Button>

            { !!props.feedback.length &&
                <>
                    <SubHeader>Given feedback ({props.feedback.length})</SubHeader>
                    <Box>
                        { props.feedback.map(({ id, feedback, response }) => {
                            let icon: React.ReactNode;
                            if (!response || !response.text) {
                                icon = (
                                    <Tooltip title="We've received your feedback!">
                                        <NewReleasesOutlinedIcon color="disabled"
                                                                 fontSize="small" />
                                    </Tooltip>
                                );
                            } else {
                                icon = (
                                    <Tooltip title="We've responsed to your feedback!">
                                        <TaskAltOutlinedIcon color="success" fontSize="small" />
                                    </Tooltip>
                                );
                            }

                            let responseDate: string | undefined;
                            if (!!response?.date) {
                                const zonedDateTime = Temporal.ZonedDateTime.from(response.date);
                                const localZonedDateTime =
                                    zonedDateTime.withTimeZone(props.timezone);

                                responseDate = formatDate(localZonedDateTime, 'MMMM D, YYYY');
                            }

                            return (
                                <Accordion key={id}>
                                    <TimedAccordionSummary date={feedback.date}
                                                           dateFormat="MMM Do, YYYY"
                                                           dateWidth={110}
                                                           icon={icon}
                                                           summary={feedback.text} />
                                    <AccordionDetails sx={{ pt: 0 }}>
                                        <Typography variant="body2" sx={{
                                            fontStyle: 'italic',
                                            whiteSpace: 'pre-line',
                                        }}>
                                            {feedback.text}
                                        </Typography>
                                        { (!response || !response.text) &&
                                            <Box sx={{
                                                borderLeft: theme =>
                                                    `4px solid ${theme.palette.warning.main}`,
                                                paddingLeft: 1.5,
                                                marginTop: 2,
                                            }}>
                                                <Typography variant="subtitle2"
                                                            sx={{ fontStyle: 'italic' }}>
                                                    We'll respond to your feedback as soon as
                                                    possible!
                                                </Typography>
                                            </Box> }
                                        { (!!response && !!response.text) &&
                                            <Box sx={{
                                                borderLeft: theme =>
                                                    `4px solid ${theme.palette.success.main}`,
                                                paddingLeft: 1.5,
                                                marginTop: 2,
                                            }}>

                                                <Typography variant="subtitle2">
                                                    {response.author} responded on {responseDate}:
                                                </Typography>
                                                <Typography variant="body2" sx={{
                                                    whiteSpace: 'pre-line',
                                                    pt: 0.5
                                                }}>
                                                    {response.text}
                                                </Typography>

                                            </Box> }
                                    </AccordionDetails>
                                </Accordion>
                            );

                        }) }
                    </Box>
                </> }

            <FeedbackDialog open={feedbackOpen} onClose={closeFeedbackDialog} />
        </>
    );
}
