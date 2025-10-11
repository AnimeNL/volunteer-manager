// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import React from 'react';
import Link from '@app/LinkProxy';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import LabelImportantIcon from '@mui/icons-material/LabelImportant';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import { formatDate } from '@lib/Temporal';
import db, { tFeedback, tUsers } from '@lib/database';

import { kEnforceSingleLine } from '@app/schedule/[event]/Constants';

/**
 * Number of feedback entries that should be shown in the table.
 */
const kFeedbackEntries = 4;

/**
 * The <FeedbackCard> component is a card that lists the most recently received feedback through the
 * Volunteer Portal. The card links through to the dedicated feedback page.
 */
export async function FeedbackCard() {
    const usersJoin = tUsers.forUseInLeftJoin();

    const feedback = await db.selectFrom(tFeedback)
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tFeedback.userId))
        .select({
            id: tFeedback.feedbackId,
            author: tFeedback.feedbackName.valueWhenNull(usersJoin.name),
            date: tFeedback.feedbackDate,
            feedback: tFeedback.feedbackText,
        })
        .orderBy(tFeedback.feedbackDate, 'desc')
        .limit(kFeedbackEntries)
        .executeSelectMany();

    if (!feedback)
        return <>{ /* no content */ }</>;

    const completedFeedback = feedback.map(entry => ({
        ...entry,
        date: formatDate(entry.date, 'MMMM Do'),
    }));

    return (
        <Card>
            <CardHeader avatar={ <FeedbackOutlinedIcon color="primary" /> }
                        title="Recent feedback"
                        slotProps={{ title: { variant: 'subtitle2' } }} />
            <Divider />
            <CardContent sx={{ p: 0 }}>
                <List dense disablePadding>
                    { completedFeedback.map(entry =>
                        <React.Fragment key={entry.id}>
                            <ListItemButton LinkComponent={Link}
                                            href={`/admin/organisation/feedback/${entry.id}`}>
                                <ListItemIcon sx={{ minWidth: '40px' }}>
                                    <LabelImportantIcon color="disabled" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={entry.feedback}
                                            secondary={`— ${entry.author}, ${entry.date}`}
                                            slotProps={{
                                                primary: { sx: kEnforceSingleLine },
                                            }}/>
                            </ListItemButton>
                            <Divider component="li" />
                        </React.Fragment> )}
                </List>
            </CardContent>
            <CardActions sx={{ justifyContent: 'flex-end' }}>
                <Button LinkComponent={Link} href="/admin/organisation/feedback" size="small">
                    Learn more
                </Button>
            </CardActions>
        </Card>
    );
}
