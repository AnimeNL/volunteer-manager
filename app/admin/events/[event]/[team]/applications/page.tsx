// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import NotInterestedIcon from '@mui/icons-material/NotInterested';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import ShareIcon from '@mui/icons-material/Share';
import TextField from '@mui/material/TextField';

import type { PartialServerAction, ServerAction, ServerActionResult } from '@lib/serverAction';
import { Application } from './Application';
import { ApplicationForm } from './ApplicationForm';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { ReconsiderApplicationButton } from './ReconsiderApplicationButton';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { generateInviteKey } from '@lib/EnvironmentContext';
import { requireAuthenticationContextWithEventAndTeam }
    from '../../requireAuthenticationContextWithEventAndTeam';
import db, { tEvents, tEventsTeams, tStorage, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

import * as actions from './ApplicationActions';

/**
 * The <ApplicationsPage> allows team leads to see individuals who have applied to participate in
 * their teams, and, when sufficient permission has been granted, to approve or reject such
 * applications.
 */
export default async function ApplicationsPage(
    props: PageProps<'/admin/events/[event]/[team]/applications'>)
{
    const { access, event, team, user } = await requireAuthenticationContextWithEventAndTeam(props,
    {
        permission: 'event.applications',
        operation: 'read',
    });

    const accessScope = { event: event.slug, team: team.slug };

    // ---------------------------------------------------------------------------------------------
    // Fetch all pending and rejected applications from the database. The pending ones will be ready
    // for action by the volunteering lead, while the rejected ones will be displayed for reference.
    // ---------------------------------------------------------------------------------------------

    const dbInstance = db;

    const storageJoin = tStorage.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoinAs('previous_events');

    const claimedByUsersJoin = tUsers.forUseInLeftJoinAs('cbuj');

    const unfilteredApplications = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsersEvents.userId))
            .and(usersEventsJoin.eventId.notEquals(tUsersEvents.eventId))
        .leftJoin(claimedByUsersJoin)
            .on(claimedByUsersJoin.userId.equals(tUsersEvents.registrationOwnerId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.registrationStatus.in(
                [ kRegistrationStatus.Registered, kRegistrationStatus.Rejected ]))
        .select({
            userId: tUsers.userId,
            age: dbInstance.fragmentWithType('int', 'required')
                .sql`TIMESTAMPDIFF(YEAR,
                    IFNULL(${tUsers.birthdate}, ${dbInstance.currentDate()}),
                    ${tEvents.eventStartTime})`,
            fullyAvailable: tUsersEvents.fullyAvailable.is(/* true= */ 1),
            date: dbInstance.dateTimeAsString(tUsersEvents.registrationDate),
            name: tUsers.name,
            firstName: tUsers.firstName,
            avatar: storageJoin.fileHash,
            status: tUsersEvents.registrationStatus,
            preferences: tUsersEvents.preferences,
            preferenceHours: tUsersEvents.preferenceHours,
            preferenceTimingStart: tUsersEvents.preferenceTimingStart,
            preferenceTimingEnd: tUsersEvents.preferenceTimingEnd,
            history: dbInstance.count(usersEventsJoin.eventId),
            claim: {
                name: claimedByUsersJoin.name,
                isCurrentUser: claimedByUsersJoin.userId.equals(user.id),
            },
            language: tUsers.language,
            suspended: tUsers.participationSuspended,
        })
        .groupBy(tUsersEvents.userId)
        .orderBy(tUsers.firstName, 'asc')
        .orderBy(tUsers.lastName, 'asc')
        .executeSelectMany();

    const applications: typeof unfilteredApplications = [];
    const rejections: typeof unfilteredApplications = [];

    for (const application of unfilteredApplications) {
        if (application.status === kRegistrationStatus.Registered)
            applications.push(application);
        else
            rejections.push(application);
    }

    // ---------------------------------------------------------------------------------------------
    // Determine the unique invite link for this team through which volunteers can directly apply.
    // This is the environment's regular application page for teams that manage content, and a link
    // with a uniquely generated invite key for those that do not.
    // ---------------------------------------------------------------------------------------------

    let inviteLink: string | undefined;
    if (!team.flags.managesContent) {
        inviteLink  = `https://${team.domain}/registration/${event.slug}/application`;
        inviteLink += `?invite=${generateInviteKey(event.slug, team.inviteKey)}`;
    }

    // ---------------------------------------------------------------------------------------------
    // Actions available to the user depend on the permissions they have been granted, and is
    // conveyed through the existence of Server Action references shared with the client.
    // ---------------------------------------------------------------------------------------------

    let approveApplicationFn:
        ((userId: number, subject?: string, message?: string) => Promise<ServerActionResult>)
            | undefined;
    let rejectApplicationFn:
        ((userId: number, subject?: string, message?: string) => Promise<ServerActionResult>)
            | undefined;

    let claimApplicationFn: PartialServerAction<number> | undefined;
    let moveApplicationFn: PartialServerAction<number> | undefined;

    if (access.can('event.applications', 'update', accessScope)) {
        approveApplicationFn = actions.decideApplication.bind(null, event.slug, team.slug, true);
        claimApplicationFn = actions.claimApplication.bind(null, event.slug, team.slug);
        moveApplicationFn = actions.moveApplication.bind(null, event.slug, team.slug);
        rejectApplicationFn = actions.decideApplication.bind(null, event.slug, team.slug, false);
    }

    let createApplicationFn: ServerAction | undefined;
    let reconsiderApplicationFn: PartialServerAction<number> | undefined;

    if (access.can('event.applications', 'create', accessScope)) {
        createApplicationFn = actions.createApplication.bind(null, event.slug, team.slug);
        reconsiderApplicationFn = actions.reconsiderApplication.bind(null, event.slug, team.slug);
    }

    // ---------------------------------------------------------------------------------------------
    // Determine the teams that a volunteer can be moved to, when the volunteer has the ability to
    // both update applications and to see at least one other team.
    // ---------------------------------------------------------------------------------------------

    const availableTeams: { id: string; label: string }[] = [];
    if (!!moveApplicationFn) {
        const unfilteredAvailableTeams = await dbInstance.selectFrom(tEventsTeams)
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tEventsTeams.teamId))
            .where(tEventsTeams.eventId.equals(event.id))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
            .select({
                id: tTeams.teamSlug,
                label: tTeams.teamName,
            })
            .orderBy('label', 'asc')
            .executeSelectMany();

        for (const availableTeam of unfilteredAvailableTeams) {
            if (availableTeam.id === team.slug)
                continue;  // unable to move volunteers to their current team

            if (!access.can('event.visible', { event: event.slug, team: availableTeam.id }))
                continue;  // unable to see the |availableTeam|

            availableTeams.push(availableTeam);
        }
    }

    // ---------------------------------------------------------------------------------------------

    // Values that should be prepopulated in the "Create an Application" form.
    const createValues = {
        serviceHours: '20',
        serviceTiming: '10-0',
    };

    return (
        <>
            <Section icon={ <NewReleasesOutlinedIcon color="primary" /> } title="Applications"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Applications' },
                     ]}>
                <SectionIntroduction>
                    Pending applications for the {team.name} during {event.shortName}.
                </SectionIntroduction>
                { !!inviteLink &&
                    <TextField size="small" fullWidth value={inviteLink}
                               slotProps={{
                                   input: {
                                       startAdornment:
                                           <InputAdornment position="start">
                                               <ShareIcon color="primary" fontSize="small" />
                                           </InputAdornment>
                                   },
                               }} /> }
            </Section>

            { applications.length === 0 &&
                <Alert severity="success" variant="filled">
                    There are no pending applications!
                </Alert> }
            { applications.length > 0 &&
                <Grid container spacing={1.5} sx={{ alignItems: 'stretch' }}>
                    { applications.map(application => {
                        const approveFn = approveApplicationFn?.bind(null, application.userId);
                        const claimFn = claimApplicationFn?.bind(null, application.userId);
                        const moveFn = moveApplicationFn?.bind(null, application.userId);
                        const rejectFn = rejectApplicationFn?.bind(null, application.userId);

                        return (
                            <Grid key={application.userId} size={{ xs: 12, md: 6 }}>
                                <Application application={application}
                                             availableTeams={availableTeams}
                                             eventId={event.id} teamId={team.id}
                                             approveFn={approveFn} claimFn={claimFn} moveFn={moveFn}
                                             rejectFn={rejectFn} />
                            </Grid>
                        );
                    }) }
                </Grid> }

            { !!createApplicationFn &&
                <FormGridSection action={createApplicationFn} title="Create an application"
                                 icon={ <PersonAddAltIcon /> }
                                 callToAction="Create the application" defaultValues={createValues}>
                    <SectionIntroduction important>
                        Quickly create an application on behalf of any registered volunteer. The
                        application will still have to be approved.
                    </SectionIntroduction>
                    <ApplicationForm eventId={event.id} teamId={team.id} />
                </FormGridSection> }

            { !!rejections.length &&
                <Section icon={ <NotInterestedIcon /> } title="Rejections">
                    <SectionIntroduction>
                        The following volunteers were rejected and will not be helping us out.
                    </SectionIntroduction>
                    <Divider />
                    <List dense disablePadding sx={{ margin: '8px -16px -8px -16px !important' }}>
                        { rejections.map(application =>
                            <ListItem key={application.userId}>
                                <ListItemIcon>
                                    <PersonOffIcon color="primary" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={application.name}
                                              secondary={
                                                  <LocalDateTime dateTime={application.date!}
                                                                 format="dddd, MMMM D, YYYY" />
                                              } />
                                { !!reconsiderApplicationFn &&
                                    <ReconsiderApplicationButton
                                        action={ reconsiderApplicationFn.bind(
                                                     null, application.userId) } /> }
                            </ListItem> ) }
                    </List>
                </Section> }
        </>
    );
}
