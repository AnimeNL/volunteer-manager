// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import Typography from '@mui/material/Typography';

import type { CachedEvent } from '@lib/cache';
import { DashboardCard } from '@app/admin/dashboard/DashboardCard';
import { DashboardCardTitle } from '@app/admin/dashboard/DashboardCardTitle';
import { DeadlineAccordion, DeadlineAccordionDetails, DeadlineAccordionSummary } from './EventDeadlinesComponents';
import { InlineAccountLink } from '@app/admin/components/InlineAccountLink';
import { formatDate } from '@lib/Temporal';
import db, { tEventsDates, tUsers } from '@lib/database';

/**
 * Props accepted by the <EventDeadlinesCard> component.
 */
interface EventDeadlinesCardProps {
    /**
     * Event for which the card is being displayed.
     */
    event: CachedEvent;
}

/**
 * Event dashboard card that displays the deadlines defined for this event.
 */
export async function EventDeadlinesCard(props: EventDeadlinesCardProps) {
    const currentTime = Temporal.Now.plainDateISO();

    const usersJoin = tUsers.forUseInLeftJoin();

    const deadlines = await db.selectFrom(tEventsDates)
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tEventsDates.dateOwnerId))
        .where(tEventsDates.eventId.equals(props.event.id))
            .and(tEventsDates.dateDate.greaterOrEqual(currentTime).or(
                tEventsDates.dateCompleted.isNull()))
            .and(tEventsDates.dateType.equals('Deadline'))
            .and(tEventsDates.dateDeleted.isNull())
        .select({
            id: tEventsDates.dateId,
            due: tEventsDates.dateDate,
            title: tEventsDates.dateTitle,
            description: tEventsDates.dateDescription,
            owner: {
                id: usersJoin.userId,
                name: usersJoin.name,
            },
            completed: tEventsDates.dateCompleted,
        })
        .orderBy(tEventsDates.dateCompleted.isNotNull(), 'asc')
            .orderBy(tEventsDates.dateDate, 'desc')
        .executeSelectMany();

    return (
        <DashboardCard sx={{ pb: 1 }}>
            <DashboardCardTitle icon={ <AssignmentOutlinedIcon /> }>
                Deadlines
            </DashboardCardTitle>
            { !deadlines.length &&
                <Alert severity="info" variant="outlined" sx={{ mx: 2, my: 1 }}>
                    There are no deadlines coming up.
                </Alert> }
            { deadlines.map(deadline =>
                <DeadlineAccordion key={deadline.id} disableGutters>
                    <DeadlineAccordionSummary expandIcon={ <ArrowDropDownIcon /> }>
                        <Typography component="span" noWrap variant="body2">
                            {deadline.title}{' '}
                            <Typography component="span" color="textDisabled" variant="inherit">
                                (due {formatDate(deadline.due, 'MMM Do')})
                            </Typography>
                        </Typography>
                    </DeadlineAccordionSummary>
                    <DeadlineAccordionDetails>
                        <Typography variant="body2">
                            {deadline.description}
                        </Typography>
                        { !!deadline.owner &&
                            <Typography color="textDisabled" variant="caption"
                                        sx={{ fontStyle: 'italic', mt: 0.5 }}>
                                Owned by <InlineAccountLink user={deadline.owner} />
                            </Typography> }
                    </DeadlineAccordionDetails>
                </DeadlineAccordion> )}
        </DashboardCard>
    );
}
