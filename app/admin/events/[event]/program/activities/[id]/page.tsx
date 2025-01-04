// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import PeopleIcon from '@mui/icons-material/People';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { NextPageParams } from '@lib/NextRouterParams';
import { formatDate } from '@lib/Temporal';
import { getAnPlanActivityUrl } from '@lib/AnPlan';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tActivities, tActivitiesLocations, tActivitiesTimeslots, tShifts, tTeams }
    from '@lib/database';

/**
 * Date and time format in which updates should be displayed.
 */
const kUpdateFormat = ' dddd, MMMM D, [at] HH:mm';

/**
 * The <ProgramLayout> component contains the common elements between the different pages that make
 * up the Program section of the Volunteer Manager. A program is bound to an event.
 */
export default async function ProgramActivityPage(props: NextPageParams<'event' | 'id'>) {
    const { event } = await verifyAccessAndFetchPageInfo(props.params);
    const { id } = await props.params;

    const activityId = parseInt(id, 10);
    if (!Number.isSafeInteger(activityId) || !event.festivalId)
        notFound();

    const dbInstance = db;
    const activity = await dbInstance.selectFrom(tActivities)
        .where(tActivities.activityId.equals(activityId))
            .and(tActivities.activityFestivalId.equals(event.festivalId))
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

    return (
        <Box component={Stack} direction="column" spacing={2} sx={{ p: 2 }}>
            <Paper variant="outlined" sx={{ p: 1 }}>
                <Typography variant="h6" sx={{ pb: .5 }}>
                    {activity.title}
                </Typography>
                { !!activity.description &&
                    <Typography variant="body2" sx={{ pb: .5 }}>
                        {activity.description}
                    </Typography> }

                <Divider sx={{ mt: .5 }} />

                <Stack divider={ <Divider flexItem /> } spacing={1} sx={{ mt: 1 }}>
                    { !!anplanLink &&
                        <Typography variant="body2">
                            <strong>AnPlan link</strong>:{' '}
                            <MuiLink component={Link} target="_blank" href={anplanLink}>
                                click
                            </MuiLink>
                        </Typography> }
                    { !!activity.url &&
                        <Typography variant="body2">
                            <strong>Website link</strong>:{' '}
                            <MuiLink component={Link} target="_blank" href={activity.url}>
                                click
                            </MuiLink>
                        </Typography> }

                    <Typography variant="body2">
                        <strong>Public</strong>: { activity.visible ? 'Yes' : 'No' }
                        { !!activity.visibleReason &&
                            <Typography component="span" variant="body2"
                                        sx={{ pl: .5, color: 'text.disabled' }}>
                                ({activity.visibleReason})
                            </Typography> }
                    </Typography>

                    <Typography variant="body2">
                        <strong>Help requested</strong>: { activity.helpRequested ? 'Yes' : 'No' }
                    </Typography>

                    { !!activity.maxVisitors &&
                        <Typography variant="body2">
                            <strong>Max visitors</strong>: {activity.maxVisitors}
                        </Typography> }

                    { !!activity.price &&
                        <Typography variant="body2">
                            <strong>Price</strong>: €{activity.price}
                        </Typography> }

                    <Typography variant="body2">
                        <strong>Created on</strong>:
                        { formatDate(activity.created.withTimeZone(event.timezone), kUpdateFormat) }
                    </Typography>

                    <Typography variant="body2">
                        <strong>Updated on</strong>:
                        { formatDate(activity.updated.withTimeZone(event.timezone), kUpdateFormat) }
                    </Typography>

                </Stack>
            </Paper>
            { timeslots.length > 0 &&
                <Paper variant="outlined" sx={{ p: 1 }}>
                    <Typography variant="h6">
                        Timeslots
                    </Typography>
                    <Stack divider={ <Divider flexItem /> } spacing={1} sx={{ mt: 1 }}>
                        { timeslots.map((timeslot, index) =>
                            <Typography key={index} variant="body2">
                                { formatDate(
                                    timeslot.start.withTimeZone(event.timezone), 'dddd, HH:mm') }–
                                { formatDate(
                                    timeslot.end.withTimeZone(event.timezone), 'HH:mm') },
                                in the{' '}
                                <MuiLink component={Link} href="../locations">
                                    {timeslot.location}
                                </MuiLink>
                            </Typography> )}
                    </Stack>
                </Paper> }
            { shifts.length > 0 &&
                <Paper variant="outlined" sx={{ p: 1 }}>
                    <Typography variant="h6">
                        Volunteering shifts
                    </Typography>
                    <Stack divider={ <Divider flexItem /> } spacing={1} sx={{ mt: 1 }}>
                        { shifts.map(({ shift, team }, index) =>
                            <Stack key={index} direction="row" spacing={1} alignContent="center">
                                <Tooltip title={team.name}>
                                    <PeopleIcon fontSize="small" htmlColor={team.colour} />
                                </Tooltip>
                                <Typography variant="body2">
                                    <MuiLink component={Link}
                                             href={`../../${team.slug}/shifts/${shift.id}`}>
                                        {shift.name}
                                    </MuiLink>{' '}
                                    ({team.name})
                                </Typography>
                            </Stack>
                        )}
                    </Stack>
                </Paper> }
        </Box>
    );
}
