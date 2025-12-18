// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import GroupIcon from '@mui/icons-material/Group';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SendIcon from '@mui/icons-material/Send';

import type { EnvironmentContext, EnvironmentContextEventAccess } from '@lib/EnvironmentContext';
import type { RegistrationStatus, ShirtFit, ShirtSize } from '@lib/database/Types';
import { EventApplicationForm, type EventApplicationFormProps } from './EventApplicationForm';
import { EventApplicationStatus } from './[team]/EventApplicationStatus';
import { FormProvider } from '@components/FormProvider';
import { FormSubmitButton } from '@components/FormSubmitButton';
import { Markdown } from '@components/Markdown';
import { determineEnvironment, type Environment } from '@lib/Environment';
import { formatDate } from '@lib/Temporal';
import { generatePortalMetadataFn } from '../../generatePortalMetadataFn';
import { getContent, getStaticContent } from '@lib/Content';
import { getEnvironmentContext } from '@lib/EnvironmentContext';
import db, { tEnvironments, tEvents, tRoles, tTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

import * as actions from './ApplicationActions';

/**
 * The <EventApplicationPage> serves three purposes: first, to explain when applications aren't
 * being presently considerer, second, to accept applications, and third, to inform the visitor of
 * the status of their application in case one has already been made.
 */
export default async function EventApplicationPage(
    props: PageProps<'/registration/[slug]/application'>)
{
    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const params = await props.params;

    const context = await getEnvironmentContext(environment);
    const event = context.events.find(event => event.slug === params.slug);

    if (!event)
        notFound();

    let redirectUrl = `https://${environment.domain}/registration/${event.slug}/application`;
    let targetTeam: EnvironmentContextEventAccess['teams'][number] | undefined;

    {
        const searchParams = await props.searchParams;
        if (Object.hasOwn(searchParams, 'invite'))
            targetTeam = event.teams.find(team => team.inviteKey === searchParams.invite);

        if (!!targetTeam)
            redirectUrl += `?invite=${targetTeam.inviteKey}`;
    }

    if (event.applications.length > 0) {
        if (!targetTeam || event.applications.some(app => app.team === targetTeam.slug)) {
            return <EventApplicationStatusPage context={context} environment={environment}
                                               event={event} />;
        }
    }

    const { access } = context;

    const acceptsApplications = event.teams.some(team => {
        if (team.applications === 'active' || team.applications === 'override')
            return true;

        if (access.can('event.applications', 'create', { event: event.slug, team: team.slug }))
            return true;

        return false;
    });

    return acceptsApplications
        ? <EventApplicationFormPage context={context} environment={environment} event={event}
                                    redirectUrl={redirectUrl} team={targetTeam} />
        : <EventApplicationNotAvailablePage />;
}

/**
 * Props available to the specialised sub-pages of the <EventApplicationPage> component.
 */
interface EventApplicationSpecialisedProps {
    /**
     * Context for which the page is being rendered.
     */
    context: EnvironmentContext;

    /**
     * Environment for which the page is being rendered.
     */
    environment: Environment;

    /**
     * Event for which the page is being rendered.
     */
    event: EnvironmentContextEventAccess;
}

/**
 * The <EventApplicationNotAvailablePage> page informs the visitor that applications are presently
 * closed, and that they may want to try again at a later point in time.
 */
async function EventApplicationNotAvailablePage() {
    const content = await getStaticContent([ 'registration', 'application', 'unavailable' ]);
    return (
        <Markdown sx={{ p: 2 }}>{content?.markdown}</Markdown>
    );
}

/**
 * Props accepted by the <EventApplicationFormPage> component.
 */
interface EventApplicationFormPageProps extends EventApplicationSpecialisedProps {
    /**
     * URL to which successful registrations (& activations) should be forwarded.
     */
    redirectUrl: string;

    /**
     * Team that the application should be made towards, if any.
     */
    team?: EnvironmentContextEventAccess['teams'][number];
};

/**
 * The <EventApplicationFormPage> page enables the visitor to apply to join one of our teams. Data
 * is being checked in this method, after which the form defers to sub-components.
 */
async function EventApplicationFormPage(props: EventApplicationFormPageProps) {
    const { environment, context, event, team } = props;

    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Determine the team to whom the application should be made. This is, by default, the team that
    // manages the content, but can be overridden by special direct-apply links.
    // ---------------------------------------------------------------------------------------------

    const applicationTeam = await dbInstance.selectFrom(tTeams)
        .where(tTeams.teamSlug.in(environment.teams))
            .and(tTeams.teamId.equalsIfValue(team?.id))
            .and(tTeams.teamFlagManagesContent.equals(/* true= */ 1).onlyWhen(!team))
        .select({
            id: tTeams.teamId,
            title: tTeams.teamTitle,
        })
        .orderBy(tTeams.teamId, 'asc')  // arbitrary, but stable
        .limit(1)
        .executeSelectNoneOrOne();

    if (!applicationTeam)
        notFound();

    // ---------------------------------------------------------------------------------------------
    // Determine context for the form, both to prepopulate known fields and to refer to applications
    // they may have in progress with teams on other environments.
    // ---------------------------------------------------------------------------------------------

    type HistoricPreferences = {
        tshirtFit?: ShirtFit;
        tshirtSize?: ShirtSize;
    };

    let historicPreferences: HistoricPreferences | undefined;
    let partnerApplications: EventApplicationFormProps['partnerApplications'] = [ /* none yet */ ];

    if (!!context.user) {
        historicPreferences = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .where(tUsersEvents.userId.equals(context.user.id))
            .select({
                tshirtFit: tUsersEvents.shirtFit,
                tshirtSize: tUsersEvents.shirtSize,
            })
            .orderBy(tEvents.eventStartTime, 'desc')
            .limit(1)
            .executeSelectNoneOrOne() ?? undefined;

        partnerApplications = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .innerJoin(tEnvironments)
                .on(tEnvironments.environmentId.equals(tTeams.teamEnvironmentId))
            .where(tUsersEvents.userId.equals(context.user.id))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.registrationStatus.in(
                    [ kRegistrationStatus.Registered, kRegistrationStatus.Accepted ]))
            .select({
                href:
                    dbInstance.const('https://', 'string')
                        .concat(tEnvironments.environmentDomain)
                        .concat('/registration/')
                        .concat(event.slug),
                status: tUsersEvents.registrationStatus,
                team: tTeams.teamName,

                environment: tTeams.teamEnvironment,
            })
            .orderBy(tTeams.teamName, 'asc')
            .executeSelectMany();
    }

    // ---------------------------------------------------------------------------------------------

    const action = actions.createApplication.bind(null, event.id, applicationTeam.id);
    const content = await getContent(environment.domain, event.id, [ 'application' ]);

    // Set default values for the application form. These may be further contextualised with the
    // volunteer's historic preferences if they've applied before, for e.g. their t-shirt size.
    const defaultValues = {
        availability: true,
        credits: true,
        serviceHours: '16',
        serviceTiming: '10-0',
        socials: true,
        ...historicPreferences,
    };

    return (
        <FormProvider action={action} defaultValues={defaultValues}>
            <Box sx={{ p: 2 }}>
                { !!content && <Markdown sx={{ pb: 2 }}>{content.markdown}</Markdown> }

                { !!team &&
                    <Alert severity="info" sx={{ mb: 2 }}>
                        You're applying to join the {applicationTeam.title}—how exciting!
                    </Alert> }


                <EventApplicationForm eventShortName={event.shortName}
                                      partnerApplications={partnerApplications}
                                      redirectUrl={props.redirectUrl}
                                      user={context.user} />

                <FormSubmitButton callToAction="Submit application" startIcon={ <SendIcon /> }
                                  sx={{ mt: 2 }} disabled={!context.user} />
            </Box>
        </FormProvider>
    );
}

/**
 * The <EventApplicationStatusPage> page represents the case in which a visitor has one of more
 * active applications, the status of which can be displayed.
 */
async function EventApplicationStatusPage(props: EventApplicationSpecialisedProps) {
    const { environment, context, event } = props;

    if (!event.applications.length || !context.user)
        throw new Error('Invalid state for the <EventApplicationStatusPage> component');

    if (event.applications.length === 1)
        return <EventApplicationStatus {...props} team={event.applications[0].team} />;

    // ---------------------------------------------------------------------------------------------
    // Fetch detailed information about the applications that the visitor has in progress for this
    // event. Sort them based on relevance assumed from the application's status.
    // ---------------------------------------------------------------------------------------------

    const detailedApplications = await db.selectFrom(tUsersEvents)
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tUsersEvents.userId.equals(context.user.id))
            .and(tUsersEvents.eventId.equals(event.id))
            .and(tTeams.teamSlug.in(environment.teams))
        .select({
            color: tTeams.teamColourLightTheme,
            date: tUsersEvents.registrationDate,
            role: tRoles.roleName,
            slug: tTeams.teamSlug,
            status: tUsersEvents.registrationStatus,
            title: tTeams.teamTitle,
        })
        .executeSelectMany();

    const kRegistrationStatusOrder: { [key in RegistrationStatus]: number } = {
        [kRegistrationStatus.Accepted]: 0,
        [kRegistrationStatus.Registered]: 1,
        [kRegistrationStatus.Rejected]: 2,
        [kRegistrationStatus.Cancelled]: 3,
    };

    detailedApplications.sort((lhs, rhs) => {
        const lhsOrder = kRegistrationStatusOrder[lhs.status];
        const rhsOrder = kRegistrationStatusOrder[rhs.status];

        if (lhsOrder === rhsOrder)
            return lhs.title.localeCompare(rhs.title);

        return lhsOrder - rhsOrder;
    });

    // ---------------------------------------------------------------------------------------------

    const content = await getStaticContent([ 'registration', 'application', 'multiple' ], {
        event: event.shortName,
    });

    return (
        <Box sx={{ p: 2 }}>
            { !!content &&
                <>
                    <Markdown sx={{ pb: 2 }}>{content.markdown}</Markdown>
                    <Divider />
                </> }
            <List sx={{ pb: 0 }}>
                { detailedApplications.map(application => {
                    const href = `/registration/${event.slug}/application/${application.slug}`;

                    let details: string;
                    let detailsSx: SxProps<Theme> | undefined;

                    switch (application.status) {
                        case kRegistrationStatus.Registered:
                            details = 'Your application is being considered';
                            break;

                        case kRegistrationStatus.Accepted:
                            details = `You're part of the team! (${application.role})`;
                            detailsSx = { color: 'success.main' };
                            break;

                        case kRegistrationStatus.Rejected:
                            details = 'We are unable to move forward with your application';
                            detailsSx = { color: 'error.main' };
                            break;

                        case kRegistrationStatus.Cancelled:
                            details = 'Your participation has been cancelled';
                            detailsSx = { color: 'error.main' };
                            break;
                    }

                    const date =
                        application.date ? formatDate(application.date, '—MMMM Do')
                                         : /* missing registration date= */ '';

                    return (
                        <ListItemButton key={application.slug} LinkComponent={Link} href={href}>
                            <ListItemIcon sx={{ minWidth: '40px' }}>
                                <GroupIcon htmlColor={application.color} />
                            </ListItemIcon>
                            <ListItemText primary={application.title}
                                          secondary={ <>{details}{date}</> }
                                          slotProps={{ secondary: { sx: detailsSx } }} />
                        </ListItemButton>
                    );
                } )}
            </List>
            <Divider sx={{ mb: 2 }} />
            <MuiLink component={Link} href={`/registration/${event.slug}`}>
                « Previous page
            </MuiLink>
        </Box>
    );
}

export const generateMetadata = generatePortalMetadataFn('Application');
