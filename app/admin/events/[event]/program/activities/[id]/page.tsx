// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Divider from '@mui/material/Divider';
import EventNoteIcon from '@mui/icons-material/EventNote';
import LabelImportantOutlinedIcon from '@mui/icons-material/LabelImportantOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import PeopleIcon from '@mui/icons-material/People';
import ScheduleIcon from '@mui/icons-material/Schedule';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { TicketConfiguration } from '@lib/tickets/Types';
import { HistorySection } from '../../HistorySection';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { ProductSalesGraph } from '../../../finance/graphs/ProductSalesGraph';
import { ProgramContactSection } from './ProgramContactSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { formatDate } from '@lib/Temporal';
import { formatTicketPrice } from '@lib/tickets/TicketHelpers';
import { getAnPlanActivityUrl } from '@lib/AnPlan';
import { requireAuthenticationWithEvent } from '@lib/auth';
import db, { tActivities, tActivitiesLocations, tActivitiesTimeslots, tShifts, tTeams }
    from '@lib/database';

import { kActivityType } from '@lib/database/Types';

/**
 * Detail page for a specific activity part of an event's program.
 */
export default async function ProgramActivityPage(
    props: PageProps<'/admin/events/[event]/program/activities/[id]'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props);
    const { id } = await props.params;

    const activityId = parseInt(id, 10);
    if (!Number.isSafeInteger(activityId) || !event.integrations?.anPlanFestivalId)
        notFound();

    const dbInstance = db;
    const activity = await dbInstance.selectFrom(tActivities)
        .where(tActivities.activityId.equals(activityId))
            .and(tActivities.activityFestivalId.equals(event.integrations.anPlanFestivalId))
            .and(tActivities.activityDeleted.isNull())
        .select({
            title: tActivities.activityTitle,
            description: tActivities.activityDescription,
            type: tActivities.activityType,

            helpRequested: tActivities.activityHelpNeeded,
            price: tActivities.activityPrice,
            maxVisitors: tActivities.activityMaxVisitors,
            url: tActivities.activityUrl,

            reportToEmail: tActivities.activityReportToEmail,
            reportToName: tActivities.activityReportToName,

            visible: tActivities.activityVisible,
            visibleReason: tActivities.activityVisibleReason,

            created: tActivities.activityCreated,
            updated: tActivities.activityUpdated,
        })
        .executeSelectNoneOrOne();

    if (!activity)
        notFound();

    const anplanLink =
        activity.type === kActivityType.Program ? getAnPlanActivityUrl(activityId) : undefined;
    const portalLink = `/schedule/${event.slug}/events/${activityId}`;

    const timeslots = await dbInstance.selectFrom(tActivitiesTimeslots)
        .innerJoin(tActivitiesLocations)
            .on(tActivitiesLocations.locationId.equals(tActivitiesTimeslots.timeslotLocationId))
        .where(tActivitiesTimeslots.activityId.equals(activityId))
            .and(tActivitiesTimeslots.timeslotDeleted.isNull())
        .select({
            id: tActivitiesTimeslots.timeslotId,
            start: tActivitiesTimeslots.timeslotStartTime,
            end: tActivitiesTimeslots.timeslotEndTime,
            location: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
        })
        .orderBy(tActivitiesTimeslots.timeslotStartTime, 'asc')
        .executeSelectMany();

    const shifts = await dbInstance.selectFrom(tShifts)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tShifts.teamId))
        .where(tShifts.eventId.equals(event.id))
            .and(tShifts.shiftActivityId.equals(activityId))
            .and(tShifts.shiftDeleted.isNull())
        .select({
            shift: {
                id: tShifts.shiftId,
                name: tShifts.shiftName,
            },
            team: {
                name: tTeams.teamName,
                colour: tTeams.teamColourLightTheme,
                slug: tTeams.teamSlug,
            },
        })
        .executeSelectMany();

    const canViewSalesGraph = access.can('statistics.basic');
    const canViewTickets = access.can('event.tickets', 'read', { event: event.slug });

    let products: number[] = [ /* none */ ];
    let tickets: TicketConfiguration[] = [ /* none */ ];

    if (canViewSalesGraph || canViewTickets) {
        const service = await createTicketService(event.id);
        if (service) {
            const configurations = await service.listTicketConfigurations(event.id);
            tickets = configurations
                .filter(config => config.activityId === activityId)
                .sort((lhs, rhs) => (lhs.name ?? '').localeCompare(rhs.name ?? ''));
            products = tickets.map(config => config.id);
        }
    }

    let canContactOwner: boolean = false;
    if (!!activity.reportToName && !!activity.reportToEmail) {
        canContactOwner =
            access.can('volunteers.program-requests', 'update', { event: event.slug });
    }

    return (
        <>
            <Section icon={ <EventNoteIcon color="primary" /> } title={activity.title}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Program', href: `/admin/events/${event.slug}/program` },
                         {
                             label: 'Activities',
                             href: `/admin/events/${event.slug}/program/activities`,
                         },
                         { label: activity.title },
                     ]}>
                <SectionIntroduction>
                    Information about an individual activity during {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader back tabs>
                { !!activity.description &&
                    <Typography variant="body2">
                        {activity.description}
                    </Typography> }
                <KeyValueList items={[
                    {
                        condition: !!anplanLink,
                        key: 'AnPlan link',
                        valueTemplate: 'component',
                        value: (
                            <MuiLink component={Link} target="_blank" href={anplanLink!}>
                                <Typography variant="body2">click</Typography>
                            </MuiLink>
                        ),
                    },
                    {
                        key: 'Portal link',
                        valueTemplate: 'component',
                        value: (
                            <MuiLink component={Link} target="_blank" href={portalLink}>
                                <Typography variant="body2">click</Typography>
                            </MuiLink>
                        ),
                    },
                    {
                        condition: !!activity.url,
                        key: 'Website link',
                        valueTemplate: 'component',
                        value: (
                            <MuiLink component={Link} target="_blank" href={activity.url!}>
                                <Typography variant="body2">click</Typography>
                            </MuiLink>
                        ),
                    },
                    {
                        key: 'Public',
                        valueTemplate: 'component',
                        value: (
                            <Typography variant="body2">
                                { activity.visible ? 'Yes' : 'No' }
                                { !!activity.visibleReason &&
                                    <Typography component="span" variant="inherit"
                                                sx={{ pl: .5, color: 'text.disabled' }}>
                                        ({activity.visibleReason})
                                    </Typography> }
                            </Typography>
                        ),
                    },
                    {
                        condition: !!activity.reportToName,
                        key: 'Activity owner',
                        value: activity.reportToName,
                    },
                    {
                        key: 'Help requested',
                        value: activity.helpRequested ? 'Yes' : 'No',
                    },
                    {
                        condition: !!activity.maxVisitors,
                        key: 'Max visitors',
                        value: activity.maxVisitors,
                    },
                    {
                        condition: !!activity.price,
                        key: 'Price',
                        value: `€${activity.price}`,
                    },
                    {
                        key: 'Created on',
                        valueTemplate: 'localDateTime',
                        value: activity.created.toString(),
                    },
                    {
                        key: 'Updated on',
                        valueTemplate: 'localDateTime',
                        value: activity.updated.toString(),
                    },
                ]} />
            </Section>
            { canContactOwner &&
                <ProgramContactSection
                    activity={{ id: activityId, title: activity.title }}
                    event={{ id: event.id, shortName: event.shortName }}
                    name={activity.reportToName!} /> }
            { timeslots.length > 0 &&
                <Section title="Timeslots" icon={ <ScheduleIcon /> }>
                    <List dense disablePadding>
                        { timeslots.map((timeslot, index) =>
                            <ListItem key={index} divider={ index !== timeslots.length - 1 }
                                      disableGutters>
                                <ListItemIcon>
                                    <LabelImportantOutlinedIcon color="primary" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        formatDate(
                                            timeslot.start.withTimeZone(event.timeZone),
                                            'dddd (HH:mm–') +
                                        formatDate(
                                            timeslot.end.withTimeZone(event.timeZone), 'HH:mm)')
                                    }
                                    secondary={timeslot.location} />
                            </ListItem> )}
                    </List>
                </Section> }
            { shifts.length > 0 &&
                <Section title="Volunteering shifts" icon={ <PeopleIcon /> }>
                    <List dense disablePadding>
                        { shifts.map(({ shift, team }, index) =>
                            <ListItem key={index} divider={ index !== shifts.length - 1 }
                                      disableGutters>
                                <ListItemIcon>
                                    <Tooltip title={team.name}>
                                        <TooltipIconWrapper>
                                            <PeopleIcon fontSize="small" htmlColor={team.colour} />
                                        </TooltipIconWrapper>
                                    </Tooltip>
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <MuiLink component={Link}
                                                 href={`../../${team.slug}/shifts/${shift.id}`}>
                                            {shift.name}
                                        </MuiLink>
                                    }
                                    secondary={team.name} />
                            </ListItem> )}
                    </List>
                </Section> }
            { !!tickets.length &&
                <Section title="Ticket sales" icon={ <LocalActivityOutlinedIcon /> }>
                    { canViewSalesGraph &&
                        <ProductSalesGraph cumulative eventId={event.id} products={products} /> }
                    { (canViewSalesGraph && canViewTickets) && <Divider /> }
                    { canViewTickets &&
                        <List dense disablePadding
                              sx={ canViewSalesGraph ? { mt: '0px !important' } : undefined }>
                            { tickets.map((ticket, index) => {
                                const href =
                                    `/admin/events/${event.slug}/tickets/visitors/${ticket.ticketTypeId}`;
                                const sales = ticket.amount !== undefined
                                    ? `${ticket.sold ?? 0} / ${ticket.amount} sold`
                                    : `${ticket.sold ?? 0} sold`;
                                const revenue =
                                    formatTicketPrice((ticket.sold ?? 0) * (ticket.price ?? 0));
                                const secondary =
                                    ticket.sold !== undefined && ticket.price !== undefined
                                        ? `${sales} · ${revenue} total revenue`
                                        : undefined;

                                return (
                                    <ListItemButton key={ticket.id} LinkComponent={Link} href={href}
                                                    divider={ index !== tickets.length - 1 }
                                                    disableGutters>
                                        <ListItemIcon>
                                            <ConfirmationNumberOutlinedIcon
                                                color="primary" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={ticket.name ?? String(ticket.ticketTypeId)}
                                            secondary={secondary}
                                            slotProps={{ primary: { noWrap: true } }} />
                                    </ListItemButton>
                                );
                            }) }
                        </List> }
                </Section> }
            <HistorySection event={event.slug} activityId={activityId} />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    { activity: 'id' }, 'Activities', 'Program', { event: 'event' });
