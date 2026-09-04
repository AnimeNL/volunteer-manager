// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import EventNoteIcon from '@mui/icons-material/EventNote';
import LabelImportantOutlinedIcon from '@mui/icons-material/LabelImportantOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import PeopleIcon from '@mui/icons-material/People';
import ScheduleIcon from '@mui/icons-material/Schedule';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { ProductSalesGraph } from '../../../finance/graphs/ProductSalesGraph';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { formatDate } from '@lib/Temporal';
import { getAnPlanActivityUrl } from '@lib/AnPlan';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tActivities, tActivitiesLocations, tActivitiesTimeslots, tEventsTicketsConfiguration,
    tShifts, tTeams } from '@lib/database';

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

            helpRequested: tActivities.activityHelpNeeded,
            price: tActivities.activityPrice,
            maxVisitors: tActivities.activityMaxVisitors,
            url: tActivities.activityUrl,

            visible: tActivities.activityVisible,
            visibleReason: tActivities.activityVisibleReason,

            created: tActivities.activityCreated,
            updated: tActivities.activityUpdated,
        })
        .executeSelectNoneOrOne();

    if (!activity)
        notFound();

    const anplanLink = getAnPlanActivityUrl(activityId);
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

    let products: number[] = [ /* none */ ];

    if (access.can('statistics.basic')) {
        products = await dbInstance.selectFrom(tEventsTicketsConfiguration)
            .where(tEventsTicketsConfiguration.eventId.equals(event.id))
                .and(tEventsTicketsConfiguration.eventTicketActivityId.equals(activityId))
            .selectOneColumn(tEventsTicketsConfiguration.eventTicketYtpId)
            .executeSelectMany();
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
                            <MuiLink component={Link} target="_blank" href={anplanLink}>
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
                        value: activity.created.toString(),
                    },
                ]} />
            </Section>
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
            { !!products.length &&
                <Section title="Ticket sales" icon={ <LocalActivityOutlinedIcon /> }>
                    <ProductSalesGraph eventId={event.id} products={products} />
                </Section> }
        </>
    );
}

export async function generateMetadata(
    props: PageProps<'/admin/events/[event]/program/activities/[id]'>)
{
    const activityTitle = await db.selectFrom(tActivities)
        .where(tActivities.activityId.equals(parseInt((await props.params).id, 10)))
        .selectOneColumn(tActivities.activityTitle)
        .executeSelectNoneOrOne() ?? undefined;

    return createGenerateMetadataFn(
        activityTitle ?? 'Activity', 'Activities', 'Program', { event: 'event' })(props);
}
