// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';

import type { CachedEvent } from '@lib/cache';
import type { CommunicationLanguage } from '@lib/database/Types';
import type { ServerAction } from '@lib/serverAction';
import type { TimelineEvent } from '@app/admin/components/Timeline';
import { ActionBar } from '@app/admin/components/ActionBar';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { StatusTile } from './StatusTile';
import { VolunteerChangeRoleQuickAction } from './VolunteerChangeRoleQuickAction';
import { VolunteerChangeTeamQuickAction } from './VolunteerChangeTeamQuickAction';
import { VolunteerContactSection } from './VolunteerContactSection';
import { VolunteerIdentitySection } from './VolunteerIdentitySection';
import { VolunteerQuickActions } from './VolunteerQuickActions';
import { VolunteerSchedule } from './VolunteerSchedule';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getBlobUrl } from '@lib/database/BlobStore';
import { getShiftsForEvent } from '@app/admin/lib/getShiftsForEvent';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tEvents, tEventsTeams, tRoles, tSchedule, tShifts, tStorage, tTeams, tTeamsRoles,
    tUsers, tUsersEvents, tUsersEventsTickets } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

import * as actions from './VolunteerActions';

/**
 * Page displaying the basic information and metadata associated with a volunteer.
 */
export default async function EventTeamVolunteerPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.participation',
        operation: 'read',
    });

    const id = parseInt((await props.params).volunteer, /* radix= */ 10);

    // ---------------------------------------------------------------------------------------------

    const storageJoin = tStorage.forUseInLeftJoin();

    const volunteer = await db.selectFrom(tUsersEvents)
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(id))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            avatarHash: storageJoin.fileHash,
            email: tUsers.username,
            language: tUsers.language,
            notes: tUsersEvents.registrationNotes,
            phoneNumber: tUsers.phoneNumber,
            role: tRoles.roleName,
            roleId: tUsersEvents.roleId,
            status: tUsersEvents.registrationStatus,

            overrides: {
                timeslotLimit: tUsersEvents.availabilityEventLimit,
                hotelEligible: tUsersEvents.hotelEligible,
                trainingEligible: tUsersEvents.trainingEligible,
            },
        })
        .executeSelectNoneOrOne();

    if (!volunteer)
        notFound();

    const accountLink = access.can('organisation.accounts', 'read')
        ? `/admin/organisation/accounts/${volunteer.id}`
        : undefined;

    const accessScope = { event: event.slug, team: team.slug };

    const canUpdateOverrides = access.can('volunteers.participation-overrides', accessScope);
    const canUpdateParticipation = access.can('volunteers.participation', 'update', accessScope);

    const canDoAnything = canUpdateParticipation || canUpdateOverrides;

    const cancelFn = (canUpdateParticipation && volunteer.status !== 'Cancelled')
        ? actions.updateVolunteerStatus.bind(
            null, volunteer.id, event.slug, team.slug, kRegistrationStatus.Cancelled)
        : undefined;

    const reinstateFn = (canUpdateParticipation && volunteer.status !== 'Accepted')
        ? actions.updateVolunteerStatus.bind(
            null, volunteer.id, event.slug, team.slug, kRegistrationStatus.Accepted)
        : undefined;

    const changeRoleFn = canUpdateParticipation
        ? actions.changeRole.bind(null, volunteer.id, event.slug, team.slug)
        : undefined;

    const changeTeamFn = canUpdateParticipation
        ? actions.changeTeam.bind(null, volunteer.id, event.slug, team.slug)
        : undefined;

    const manageOverridesFn = canUpdateOverrides
        ? actions.updateOverrides.bind(null, volunteer.id, event.slug, team.slug)
        : undefined;

    const updateNotesFn = canUpdateParticipation
        ? actions.updateNotes.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    // ---------------------------------------------------------------------------------------------

    const ticketStatus = event.tickets?.volunteerTicketId
        ? <TicketStatusTile event={event.id} user={volunteer.id} />
        : undefined;

    const hasAnyStatusTile = !!ticketStatus;

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Section icon={ <PersonOutlinedIcon color="primary" /> } title={volunteer.name}
                     limited={!canUpdateParticipation}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Volunteers',
                             href: `/admin/events/${event.slug}/${team.slug}/volunteers`,
                         },
                         { label: volunteer.name },
                     ]}>
                <SectionIntroduction>
                    Overview of {volunteer.name}'s participation in {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                { !canDoAnything &&
                    <Alert severity="warning" variant="outlined">
                        You do not have permission to make changes to this volunteer. Contact a
                        Staff member for assistance if you need to.
                    </Alert> }
                { !!canDoAnything &&
                    <ActionBar>
                        { !!changeRoleFn &&
                            <Suspense fallback={null}>
                                <VolunteerChangeRoleAction action={changeRoleFn}
                                                           currentRoleId={volunteer.roleId}
                                                           firstName={volunteer.firstName}
                                                           teamId={team.id} />
                            </Suspense> }
                        { !!changeTeamFn &&
                            <Suspense fallback={null}>
                                <VolunteerChangeTeamAction action={changeTeamFn}
                                                           currentTeamId={team.id}
                                                           eventId={event.id}
                                                           volunteer={volunteer} />
                            </Suspense> }
                        <VolunteerQuickActions cancelFn={cancelFn}
                                               eventId={event.id}
                                               manageOverrides={volunteer.overrides}
                                               manageOverridesFn={manageOverridesFn}
                                               reinstateFn={reinstateFn}
                                               teamId={team.id}
                                               volunteer={volunteer} />
                    </ActionBar> }
            </Section>

            <VolunteerIdentitySection action={updateNotesFn} notes={volunteer.notes}
                                      details={{
                                          accountLink,
                                          avatar: getBlobUrl(volunteer.avatarHash),
                                          cancelled: volunteer.status !== 'Accepted',
                                          email: volunteer.email,
                                          name: volunteer.name,
                                          phoneNumber: volunteer.phoneNumber,
                                          role: volunteer.role,
                                      }} />

            <VolunteerContactSection event={event.id} team={team.id} user={{
                id: volunteer.id,
                name: volunteer.name,
            }} />

            { hasAnyStatusTile &&
                <Grid container spacing={1.5}>
                    { !!ticketStatus &&
                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <StatusTile href={`../../tickets/volunteers/${volunteer.id}`}
                                        title="Festival ticket" type="ticket">
                                {ticketStatus}
                            </StatusTile>
                        </Grid> }
                </Grid> }

            <Suspense fallback={
                <Section icon={ <ScheduleIcon /> } title="Schedule">
                    <SectionLoading />
                </Section>
            }>
                <VolunteerScheduleSection event={event} volunteerId={volunteer.id} />
            </Suspense>
        </>
    );
}

// -------------------------------------------------------------------------------------------------

/**
 * Props accepted by the <VolunteerChangeRoleAction> component.
 */
interface VolunteerChangeRoleActionProps {
    /**
     * Server Action to execute when changing the volunteer's role.
     */
    action: ServerAction<{ role: number }>;

    /**
     * Unique ID of the role the volunteer currently holds.
     */
    currentRoleId: number;

    /**
     * First name of the volunteer, to contextualise warnings.
     */
    firstName: string;

    /**
     * Unique ID of the team for which roles should be obtained.
     */
    teamId: number;
}

/**
 * Async subcomponent that queries team-specific roles for the Change Role quick action.
 */
async function VolunteerChangeRoleAction(props: VolunteerChangeRoleActionProps) {
    const roles = await db.selectFrom(tTeamsRoles)
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tTeamsRoles.roleId))
        .where(tTeamsRoles.teamId.equals(props.teamId))
        .select({
            id: tRoles.roleId,
            label: tRoles.roleName,
            privilegeWarning: tRoles.rolePermissionGrant.isNotNull(),
        })
        .orderBy(tRoles.roleOrder, 'asc')
        .executeSelectMany();

    return (
        <VolunteerChangeRoleQuickAction action={props.action}
                                        currentRole={props.currentRoleId}
                                        firstName={props.firstName}
                                        roles={roles} />
    );
}

/**
 * Props accepted by the <VolunteerChangeTeamAction> component.
 */
interface VolunteerChangeTeamActionProps {
    /**
     * Server Action to execute when changing the volunteer's team.
     */
    action: ServerAction<{ message?: string; subject?: string; team: string }>;

    /**
     * Unique ID of the team that the volunteer currently participates in.
     */
    currentTeamId: number;

    /**
     * Unique ID of the event for which the teams should be retrieved.
     */
    eventId: number;

    /**
     * The volunteer for whom the team is being changed.
     */
    volunteer: {
        id: number;
        firstName: string;
        language?: CommunicationLanguage;
    };
}

/**
 * Async subcomponent that queries event teams for the Change Team quick action.
 */
async function VolunteerChangeTeamAction(props: VolunteerChangeTeamActionProps) {
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const teams = await db.selectFrom(tEvents)
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.eventId.equals(tEvents.eventId))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .innerJoin(tTeamsRoles)
            .on(tTeamsRoles.teamId.equals(tTeams.teamId))
                .and(tTeamsRoles.roleDefault.equals(/* true= */ 1))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
                .and(usersEventsJoin.teamId.equals(tEventsTeams.teamId))
                .and(usersEventsJoin.userId.equals(props.volunteer.id))
        .where(tEvents.eventId.equals(props.eventId))
        .select({
            id: tTeams.teamId,
            colour: tTeams.teamColourLightTheme,
            name: tTeams.teamName,
            slug: tTeams.teamSlug,
            status: usersEventsJoin.registrationStatus,
        })
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    return (
        <VolunteerChangeTeamQuickAction action={props.action}
                                        currentTeamId={props.currentTeamId}
                                        eventId={props.eventId}
                                        teams={teams}
                                        volunteer={props.volunteer} />
    );
}

/**
 * Props accepted by the <VolunteerScheduleSection> component.
 */
interface VolunteerScheduleSectionProps {
    /**
     * Information about the event this volunteer will participate in.
     */
    event: CachedEvent;

    /**
     * Unique ID of the volunteer whose schedule should be displayed.
     */
    volunteerId: number;
}

/**
 * Async subcomponent that queries shift schedules and renders the timeline section.
 */
async function VolunteerScheduleSection(props: VolunteerScheduleSectionProps) {
    const { event, volunteerId } = props;

    const scheduledShifts = await db.selectFrom(tSchedule)
        .innerJoin(tShifts)
            .on(tShifts.shiftId.equals(tSchedule.shiftId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tShifts.teamId))
        .where(tSchedule.eventId.equals(event.id))
            .and(tSchedule.userId.equals(volunteerId))
            .and(tSchedule.shiftId.isNotNull())
            .and(tSchedule.scheduleDeleted.isNull())
        .select({
            id: tSchedule.scheduleId,
            start: tSchedule.scheduleTimeStart,
            end: tSchedule.scheduleTimeEnd,
            title: tShifts.shiftName,

            shiftId: tSchedule.shiftId,
            shiftTeam: tTeams.teamSlug,
        })
        .executeSelectMany();

    if (!scheduledShifts.length)
        return null;

    const schedule: TimelineEvent[] = [];
    const shifts = await getShiftsForEvent(event.id, event.integrations?.anPlanFestivalId);
    const shiftMap = new Map(shifts.map(shift => ([ shift.id, shift.colour ])));

    for (const scheduledShift of scheduledShifts) {
        schedule.push({
            id: scheduledShift.id,
            start: scheduledShift.start.toString({ timeZoneName: 'never' }),
            end: scheduledShift.end.toString({ timeZoneName: 'never' }),
            color: shiftMap.get(scheduledShift.shiftId!),
            title: scheduledShift.title,

            // Private data to enable double clicking on shift entries:
            animeConShiftId: scheduledShift.shiftId!,
            animeConShiftTeam: scheduledShift.shiftTeam,
        });
    }

    const scheduleEvent = {
        startTime: event.startTime.toString(),
        endTime: event.endTime.toString(),
        timezone: event.timeZone,
    };

    const scheduleSubtitle = `${schedule.length} shift${schedule.length !== 1 ? 's' : ''}`;

    return (
        <Section icon={ <ScheduleIcon /> } title="Schedule" subtitle={scheduleSubtitle}>
            <VolunteerSchedule event={scheduleEvent} schedule={schedule} />
        </Section>
    );
}

// -------------------------------------------------------------------------------------------------

/**
 * Tile that displays the status of a volunteer's ticket, which we intend to grant (automatically)
 * before the festival starts.
 */
async function TicketStatusTile(props: { event: number; user: number; }) {
    const ticket = await db.selectFrom(tUsersEventsTickets)
        .where(tUsersEventsTickets.userId.equals(props.user))
            .and(tUsersEventsTickets.eventId.equals(props.event))
        .selectOneColumn(tUsersEventsTickets.ticketProviderPurchaseId.isNotNull())
        .executeSelectNoneOrOne();

    if (!!ticket) {
        return <Chip color="success" label="Issued" size="small" />;
    } else {
        return <Chip color="warning" label="Pending" size="small" />;
    }
}

// -------------------------------------------------------------------------------------------------

export const generateMetadata =
    createGenerateMetadataFn({ user: 'volunteer' }, 'Volunteers', { team: 'team' },
                             { event: 'event' });
