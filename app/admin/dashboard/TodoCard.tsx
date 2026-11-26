// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import type { AccessControl } from '@lib/auth/access';
import { DashboardCard } from './DashboardCard';
import { DashboardCardTitle } from './DashboardCardTitle';
import { LocalDateDuration } from '../components/LocalDateDuration';
import db, { tFeedback, tUsers } from '@lib/database';

/**
 * Describes a single actionable item displayed in the dashboard <TodoCard>.
 */
interface TodoItem {
    /**
     * Unique key for this todo item.
     */
    id: string;

    /**
     * Category icon to display alongside the item.
     */
    icon: 'feedback';

    /**
     * Primary text describing the action needed.
     */
    primary: string;

    /**
     * UTC timestamp associated with the item, rendered as a relative duration.
     */
    date: string;

    /**
     * Destination URL to resolve this item.
     */
    href: string;
}

/**
 * Queries all open todo items assigned to the volunteer identified by `userId`.
 */
export async function queryTodoItems(userId: number, access: AccessControl): Promise<TodoItem[]> {
    const items: TodoItem[] = [];

    if (access.can('organisation.feedback')) {
        const usersJoin = tUsers.forUseInLeftJoin();

        const dbInstance = db;
        const feedback = await dbInstance.selectFrom(tFeedback)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tFeedback.userId))
            .where(tFeedback.feedbackAssignedUserId.equals(userId))
                .and(tFeedback.feedbackResponse.isNull())
            .select({
                id: tFeedback.feedbackId,
                author: usersJoin.name.valueWhenNull(tFeedback.feedbackName),
                date: dbInstance.dateTimeAsString(tFeedback.feedbackDate),
                feedback: tFeedback.feedbackText,
            })
            .orderBy(tFeedback.feedbackDate, 'asc')
            .executeSelectMany();

        for (const entry of feedback) {
            items.push({
                id: `feedback-${entry.id}`,
                icon: 'feedback',
                primary: `Respond to feedback from ${entry.author ?? 'a volunteer'}`,
                date: entry.date,
                href: `/admin/organisation/feedback/${entry.id}`,
            });
        }
    }

    return items;
}

/**
 * Props accepted by the <TodoCard> component.
 */
interface TodoCardProps {
    /**
     * Open todo items to display for the signed-in volunteer.
     */
    items: TodoItem[];
}

/**
 * The <TodoCard> highlights open action items assigned to the signed-in volunteer on the main
 * administration dashboard.
 */
export function TodoCard(props: TodoCardProps) {
    return (
        <DashboardCard warning>
            <DashboardCardTitle>
                Your action items
            </DashboardCardTitle>
            <List dense disablePadding sx={{ px: 2, pb: 1 }}>
                { props.items.map(item =>
                    <ListItemButton key={item.id} LinkComponent={Link} href={item.href}
                                    sx={{ borderRadius: 1, mx: -1, px: 1 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                            { item.icon === 'feedback' &&
                                <FeedbackOutlinedIcon color="inherit" fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText primary={item.primary}
                                        slotProps={{
                                            primary: { noWrap: true },
                                        }} />
                        <Typography color="textDisabled" variant="body2" noWrap
                                    sx={{ ml: 2, flexShrink: 0 }}>
                            <LocalDateDuration dateTime={item.date} />
                        </Typography>
                    </ListItemButton> ) }
            </List>
        </DashboardCard>
    );
}
