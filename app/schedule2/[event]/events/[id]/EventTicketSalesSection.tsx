// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';

import type { EventTicketSalesEntry } from '../../lib/data/ticketData';
import { ScheduleListRow } from '../../components/ScheduleList';
import { ScheduleSection } from '../../components/ScheduleSection';
import { formatEuroPrice } from '../../lib/format';
import { getSchedulePath } from '../../lib/navigationTypes';

/**
 * Props accepted by the <EventTicketSalesSection> component.
 */
interface EventTicketSalesSectionProps {
    activityId: number;
    canViewTickets: boolean;
    eventSlug: string;
    sales: EventTicketSalesEntry[];
}

/**
 * Displays ticket sales and capacity progress for a program event when sales reporting is enabled.
 */
export function EventTicketSalesSection(props: EventTicketSalesSectionProps) {
    const { activityId, canViewTickets, eventSlug, sales } = props;
    if (!sales.length)
        return null;

    return (
        <ScheduleSection title="Tickets sold">
            { sales.map(entry => {
                const isSoldOut = entry.limit !== undefined && entry.sold >= entry.limit;
                const progress = entry.limit !== undefined
                    ? Math.min(100, Math.round((entry.sold / entry.limit) * 100))
                    : undefined;
                const progressColor = isSoldOut
                    ? 'error'
                    : ((progress ?? 0) < 75 ? 'success' : 'warning');
                const price = entry.price !== undefined
                    ? ` · ${formatEuroPrice(entry.price)}`
                    : '';

                const trailing = entry.limit !== undefined ? (
                    <>
                        <Box
                            component="span"
                            sx={{
                                color: isSoldOut ? 'error.main' : 'text.primary',
                                fontWeight: isSoldOut ? 600 : 500,
                            }}>
                            {entry.sold}
                        </Box>
                        {` / ${entry.limit}${price}`}
                    </>
                ) : (
                    <>
                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                            {entry.sold}
                        </Box>
                        {` sold${price}`}
                    </>
                );

                const href = canViewTickets
                    ? getSchedulePath(eventSlug, `/events/${activityId}/tickets/${entry.id}`)
                    : undefined;

                return (
                    <ScheduleListRow
                        key={entry.id}
                        chevron={canViewTickets}
                        href={href}
                        progress={progress}
                        progressColor={progressColor}
                        title={entry.name}
                        trailing={trailing} />
                );
            }) }
        </ScheduleSection>
    );
}
