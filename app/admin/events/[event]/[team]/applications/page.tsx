// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import ShareIcon from '@mui/icons-material/Share';
import Stack from '@mui/material/Stack';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { PartialServerAction, ServerAction } from '@lib/serverAction';
import { Application } from './Application';
import { ApplicationForm } from './ApplicationForm';
import { CollapsableSection } from '@app/admin/components/CollapsableSection';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { PlaceholderPaper } from '@app/admin/components/PlaceholderPaper';
import { RejectedApplication } from './RejectedApplication';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { generateInviteKey } from '@lib/EnvironmentContext';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEvents, tEventsTeams, tStorage, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

import * as actions from './ApplicationActions';

/**
 * Component that displays a placeholder when no applications are currently pending for the team in
 * question. They might still be able to create new applications, but in a sense it's a dull page.
 */
function NoPendingApplications() {
    return (
        <PlaceholderPaper sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} justifyContent="flex-start">
                <TaskAltIcon color="disabled" />
                <Typography sx={{ color: 'text.disabled' }}>
                    There are no pending applications
                </Typography>
            </Stack>
        </PlaceholderPaper>
    );
}

/**
 * The <ApplicationsPage> allows team leads to see individuals who have applied to participate in
 * their teams, and, when sufficient permission has been granted, to approve or reject such
 * applications.
 */
export default async function ApplicationsPage(
    props: PageProps<'/admin/events/[event]/[team]/applications'>)
{
    const params = await props.params;
    const accessScope = {
        event: params.event,
        team: params.team,
    };

    const { access, event, team } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.applications',
        operation: 'read',
        scope: accessScope,
    });

    // ---------------------------------------------------------------------------------------------
    // Fetch all pending and rejected applications from the database. The pending ones will be ready
    // for action by the volunteering lead, while the rejected ones will be displayed for reference.
    // ---------------------------------------------------------------------------------------------

    const dbInstance = db;

    const storageJoin = tStorage.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoinAs('previous_events');

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
    if (!team.flagManagesContent) {
        inviteLink  = `https://${team.domain}/registration/${event.slug}/application`;
        inviteLink += `?invite=${generateInviteKey(event.slug, team.key)}`;
    }

    // ---------------------------------------------------------------------------------------------
    // Actions available to the user depend on the permissions they have been granted, and is
    // conveyed through the existence of Server Action references shared with the client.
    // ---------------------------------------------------------------------------------------------

    let approveApplicationFn: PartialServerAction<number> | undefined;
    let moveApplicationFn: PartialServerAction<number> | undefined;
    let rejectApplicationFn: PartialServerAction<number> | undefined;

    if (access.can('event.applications', 'update', accessScope)) {
        approveApplicationFn = actions.decideApplication.bind(null, event.slug, team.slug, true);
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

    // Whether the signed in user has the ability to link through to their volunteering account.
    const canAccessAccounts = access.can('organisation.accounts', 'read');

    // Whether the signed in user has the ability to commit actions without communication.
    const canRespondSilently = access.can('organisation.silent');

    return (
        <>
            <Section title="Applications" subtitle={team.name}>
                <SectionIntroduction>
                    Please try to review and respond to each application within a week, and be sure
                    to discuss selection criteria with your Staff member!
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

            { applications.length === 0 && <NoPendingApplications /> }
            { applications.length > 0 &&
                <Grid container alignItems="stretch" spacing={2}>
                    { applications.map(application => {
                        const approveFn = approveApplicationFn?.bind(null, application.userId);
                        const moveFn = moveApplicationFn?.bind(null, application.userId);
                        const rejectFn = rejectApplicationFn?.bind(null, application.userId);

                        return (
                            <Grid key={application.userId} size={{ xs: 12, md: 6 }}>
                                <Application application={application}
                                             availableTeams={availableTeams}
                                             canAccessAccounts={canAccessAccounts}
                                             canRespondSilently={canRespondSilently}
                                             event={event.slug} team={team.slug}
                                             approveFn={approveFn} moveFn={moveFn}
                                             rejectFn={rejectFn} />
                            </Grid>
                        );
                    }) }
                </Grid> }

            { !!createApplicationFn &&
                <FormGridSection action={createApplicationFn} title="Create an application"
                                 callToAction="Create the application" defaultValues={createValues}>
                    <SectionIntroduction important>
                        This feature lets you quickly create an application on behalf of any
                        registered volunteer. Please make sure all information is accurate, as you
                        are responsible for its correctness. The application will still need to be
                        approved, at which point the volunteer will be notified.
                    </SectionIntroduction>
                    <ApplicationForm eventId={event.id} teamId={team.id} />
                </FormGridSection> }

            <CollapsableSection in={!!rejections.length} title="Rejected applications">
                { !!rejectApplicationFn &&
                    <SectionIntroduction important>
                        You don't have permission to reconsider these applications. If you believe
                        someone should be reconsidered, please contact your Staff member.
                    </SectionIntroduction> }
                <Stack direction="column" spacing={2}>
                    { rejections.map(application =>
                        <RejectedApplication key={application.userId}
                                             application={application}
                                             reconsiderFn={
                                                 !!reconsiderApplicationFn
                                                     ? reconsiderApplicationFn.bind(
                                                         null, application.userId)
                                                     : undefined
                                             } /> )}
                </Stack>
            </CollapsableSection>
        </>
    );
}
