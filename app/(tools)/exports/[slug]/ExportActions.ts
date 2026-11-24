// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod/v4';

import type { ExportType, VendorTeam } from '@lib/database/Types';
import { LogBuilder } from '@lib/log';
import { executeServerAction } from '@lib/serverAction';
import { formatDate } from '@lib/Temporal';
import { readSetting } from '@lib/Settings';
import db, { tEvents, tExports, tExportsLogs, tRoles, tTeams, tTrainings, tTrainingsAssignments,
    tTrainingsExtra, tUsers, tUsersEvents, tUsersEventsPreferencesAvailability,
    tUsersEventsPreferencesParticipation, tUsersEventsPreferencesRefunds, tVendors }
        from '@lib/database';

import { kAvailabilityBuildUpTearDownScheme }
    from '@app/(registration)/registration/[slug]/application/AvailabilityBuildUpTearDownScheme';
import { kExportType, kRegistrationStatus, kVendorTeam } from '@lib/database/Types';

/**
 * Data export type definition for build-up and tear-down volunteer lists.
 */
export type BuildUpTearDownDataExport = {
    date: string;
    volunteers: {
        name: string;
        role: string;
        team: string;
        availability: string;
    }[];
}[];

/**
 * Data export type definition for credit reel consent.
 */
export interface CreditsDataExport {
    declined: string[];
    included: {
        role: string;
        volunteers: string[];
    }[];
}

/**
 * Data export type definition for Discord handles.
 */
export interface DiscordDataExport {
    granted: {
        name: string;
        role: string;
        handle: string;
    }[];
    revoked: {
        name: string;
        handle: string;
    }[];
}

/**
 * Data export type definition for refund requests.
 */
export interface RefundsDataExport {
    requests: {
        date: string;
        name: string;
        ticketNumber?: string;
        accountIban: string;
        accountName: string;
    }[];
}

/**
 * Data export type definition for training participation.
 */
export interface TrainingsDataExport {
    sessions: {
        date: string;
        volunteers: {
            name: string;
            email: string;
            birthdate: string;
        }[];
    }[];
}

/**
 * Data export type definition for volunteer participation. This follows the structure that is
 * preferred by the AnimeCon Desk team.
 */
export type VolunteersDataExport = {
    department: string;
    role: string;
    email: string;
    firstName: string;
    prefix: string;
    lastName: string;
    gender: string;
    age?: number;
    shirtSize?: string;
    shirtFit?: string;
}[];

/**
 * Data export type definition for WhatsApp contact details.
 */
export type WhatsAppDataExport = {
    role: string;
    name: string;
    phoneNumber: string;
}[];

/**
 * Default department to assign people to when none has been explicitly set.
 */
const kDefaultDepartment = 'HR & Security';

/**
 * Threshold, in milliseconds, within which reloads of the data will be ignored for logging
 * purposes. This ensures that fast subsequent access does not needlessly affect view limits.
 */
const kReloadIgnoreThreshold = 5 /* = minutes */ * 60 * 1000;

/**
 * Picks either `left` or `right` depending on which one comes (alphabetically) first.
 */
function pickAlphaFirst(left: string, right: string): string {
    return left.localeCompare(right) < 1 ? left : right;
}

/**
 * Zod type that describes the data required when accessing a shared data export.
 */
const kAccessExportData = z.object({
    /**
     * Unique slug associated with the data export. These are random and non-incremental.
     */
    slug: z.string().nonempty(),
});

/**
 * Metadata describing a validated, active data export.
 */
interface ExportMetadata {
    id: number;
    eventId: number;
    eventName: string;
    eventStartTime: Temporal.ZonedDateTime;
    eventEndTime: Temporal.ZonedDateTime;
    teamId?: number;
    type: ExportType;
    maximumViews: number;
    views: number;
}

/**
 * Records an access log entry if the visitor has not accessed this export within the reload
 * threshold. Returns whether a new log entry was written.
 */
async function recordExportAccess(
    dbInstance: typeof db, exportId: number, ip: string, userId?: number): Promise<boolean>
{
    const lastLogEntryDateTime = await dbInstance.selectFrom(tExportsLogs)
        .where(tExportsLogs.exportId.equals(exportId))
            .and(tExportsLogs.accessIpAddress.equals(ip))
        .selectOneColumn(tExportsLogs.accessDate)
        .orderBy(tExportsLogs.accessDate, 'desc')
        .limit(/* only the latest= */ 1)
        .executeSelectNoneOrOne();

    const millisecondsSinceLastLogEntry =
        lastLogEntryDateTime?.until(Temporal.Now.zonedDateTimeISO('UTC'), {
            largestUnit: 'millisecond',
        }).milliseconds;

    if (millisecondsSinceLastLogEntry && millisecondsSinceLastLogEntry <= kReloadIgnoreThreshold)
        return false;

    const requestHeaders = await headers();

    await dbInstance.insertInto(tExportsLogs)
        .set({
            exportId,
            accessDate: dbInstance.currentZonedDateTime(),
            accessIpAddress: ip,
            accessUserAgent: requestHeaders.get('user-agent') ?? '(unknown)',
            accessUserId: userId,
        })
        .executeInsert();

    return true;
}

/**
 * Exports volunteer availability for build-up or tear-down days.
 */
async function exportBuildUpOrTearDown(
    dbInstance: typeof db, metadata: ExportMetadata): Promise<BuildUpTearDownDataExport>
{
    const kNotAvailable = 'No';

    const availabilityJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();

    const volunteers = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .leftJoin(availabilityJoin)
            .on(availabilityJoin.userId.equals(tUsersEvents.userId))
                .and(availabilityJoin.eventId.equals(tUsersEvents.eventId))
                .and(availabilityJoin.teamId.equals(tUsersEvents.teamId))
                .and(availabilityJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
        .where(tUsersEvents.eventId.equals(metadata.eventId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(tUsersEvents.teamId.equalsIfValue(metadata.teamId))
        .select({
            name: tUsers.name,
            availability: dbInstance.aggregateAsArray({
                availability: availabilityJoin.availabilityBuildUpTearDown,
                role: tRoles.roleName,
                team: tTeams.teamName,
            }),
        })
        .groupBy(tUsers.userId)
        .executeSelectMany();

    type EventEntries = BuildUpTearDownDataExport[number]['volunteers'];

    const eventDayEntries: EventEntries = [];
    const eventDayDiffOneEntries: EventEntries = [];

    for (const volunteer of volunteers) {
        let eventDay: string = kNotAvailable;
        let eventDayDiffOne: string = kNotAvailable;

        const roles = new Set<string>();
        const teams = new Set<string>();

        for (const { availability, role, team } of volunteer.availability) {
            roles.add(role);
            teams.add(team);

            try {
                const deserialisedAvailability = JSON.parse(availability || '');
                const parsedAvailability =
                    kAvailabilityBuildUpTearDownScheme.parse(deserialisedAvailability);

                if (metadata.type === kExportType.BuildUp) {
                    eventDay = pickAlphaFirst(eventDay, parsedAvailability.buildUpOpening);
                    eventDayDiffOne = pickAlphaFirst(
                        eventDayDiffOne, parsedAvailability.buildUpDayBefore);
                } else {
                    eventDay = pickAlphaFirst(eventDay, parsedAvailability.tearDownClosing);
                    eventDayDiffOne = pickAlphaFirst(
                        eventDayDiffOne, parsedAvailability.tearDownDayAfter);
                }
            } catch (error: any) {
                console.warn('Invalid availability information:', error);
                if (availability && availability.length) {
                    console.warn('Invalid availability information seen for:', volunteer.name);
                }
            }
        }

        const entry = {
            name: volunteer.name,
            role: [ ...roles ].sort().join(', '),
            team: [ ...teams ].sort().join(', '),
        };

        if (eventDay !== kNotAvailable)
            eventDayEntries.push({ availability: eventDay, ...entry });

        if (eventDayDiffOne !== kNotAvailable)
            eventDayDiffOneEntries.push({ availability: eventDayDiffOne, ...entry });
    }

    function pushIfNotEmpty(
        target: BuildUpTearDownDataExport,
        entries: EventEntries,
        referenceDate: Temporal.ZonedDateTime,
        referenceDateDiff: number)
    {
        if (!entries.length)
            return;

        entries.sort((lhs, rhs) => {
            const availabilityOrder = lhs.availability.localeCompare(rhs.availability);
            return availabilityOrder !== 0 ? availabilityOrder : lhs.name.localeCompare(rhs.name);
        });

        target.push({
            date: formatDate(referenceDate.add({ days: referenceDateDiff }), 'dddd, MMMM Do'),
            volunteers: entries,
        });
    }

    const result: BuildUpTearDownDataExport = [];
    if (metadata.type === kExportType.BuildUp) {
        pushIfNotEmpty(result, eventDayDiffOneEntries, metadata.eventStartTime, -1);
        pushIfNotEmpty(result, eventDayEntries, metadata.eventStartTime, 0);
    } else {
        pushIfNotEmpty(result, eventDayEntries, metadata.eventEndTime, 0);
        pushIfNotEmpty(result, eventDayDiffOneEntries, metadata.eventEndTime, 1);
    }
    return result;
}

/**
 * Exports credit reel consent grouped by role.
 */
async function exportCredits(
    dbInstance: typeof db, metadata: ExportMetadata): Promise<CreditsDataExport>
{
    const credits: CreditsDataExport = { declined: [], included: [] };
    const preferencesJoin = tUsersEventsPreferencesParticipation.forUseInLeftJoin();

    const volunteers = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .leftJoin(preferencesJoin)
            .on(preferencesJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesJoin.preferenceVersionIsLatest.equals(1))
        .where(tUsersEvents.eventId.equals(metadata.eventId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(tUsersEvents.teamId.equalsIfValue(metadata.teamId))
        .select({
            name: tUsers.name,
            role: tRoles.roleName,
            included: preferencesJoin.participationIncludeCreditReel.valueWhenNull(1),
        })
        .orderBy(tRoles.roleOrder, 'asc')
        .orderBy(tRoles.roleName, 'asc')
        .orderBy('name', 'asc')
        .executeSelectMany();

    let currentRoleGroup: string[] = [];
    let currentRole: string | null = null;

    for (const volunteer of volunteers) {
        if (!volunteer.included) {
            credits.declined.push(volunteer.name);
            continue;
        }

        if (currentRole !== volunteer.role) {
            if (currentRole && currentRoleGroup.length > 0)
                credits.included.push({ role: currentRole, volunteers: currentRoleGroup });

            currentRoleGroup = [];
            currentRole = volunteer.role;
        }

        currentRoleGroup.push(volunteer.name);
    }

    if (currentRole && currentRoleGroup.length > 0)
        credits.included.push({ role: currentRole, volunteers: currentRoleGroup });

    return credits;
}

/**
 * Exports Discord handles split into granted and revoked lists.
 */
async function exportDiscord(
    dbInstance: typeof db, metadata: ExportMetadata): Promise<DiscordDataExport>
{
    const discord: DiscordDataExport = { granted: [], revoked: [] };

    const rolesJoin = tRoles.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const usersWithKnownDiscordHandle = await dbInstance.selectFrom(tUsers)
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsers.userId))
                .and(usersEventsJoin.eventId.equals(metadata.eventId))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
                .and(usersEventsJoin.teamId.equalsIfValue(metadata.teamId))
        .leftJoin(rolesJoin)
            .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
        .where(tUsers.discordHandle.isNotNull())
        .select({
            name: tUsers.name,
            role: rolesJoin.roleName,
            handle: tUsers.discordHandle,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    for (const { name, role, handle } of usersWithKnownDiscordHandle) {
        if (!handle)
            continue;  // make TypeScript happy

        if (!!role)
            discord.granted.push({ name, role, handle });
        else
            discord.revoked.push({ name, handle });
    }

    return discord;
}

/**
 * Exports volunteer refund requests.
 */
async function exportRefunds(
    dbInstance: typeof db, metadata: ExportMetadata): Promise<RefundsDataExport>
{
    const refundRequests = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsersEventsPreferencesRefunds)
            .on(tUsersEventsPreferencesRefunds.eventId.equals(tUsersEvents.eventId))
                .and(tUsersEventsPreferencesRefunds.userId.equals(tUsersEvents.userId))
                .and(tUsersEventsPreferencesRefunds.preferenceVersionIsLatest.equals(
                    /* true= */ 1))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(metadata.eventId))
            .and(tUsersEvents.teamId.equalsIfValue(metadata.teamId))
        .select({
            date: tUsersEventsPreferencesRefunds.preferenceVersion,
            name: tUsers.name,
            ticketNumber: tUsersEventsPreferencesRefunds.refundTicketNumber,
            accountIban: tUsersEventsPreferencesRefunds.refundAccountIban,
            accountName: tUsersEventsPreferencesRefunds.refundAccountName,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    return {
        requests: refundRequests.map((request) => ({
            date: request.date.toString(),
            name: request.name,
            ticketNumber: request.ticketNumber,
            accountIban: request.accountIban,
            accountName: request.accountName,
        })),
    };
}

/**
 * Exports confirmed training sessions grouped by date.
 */
async function exportTrainings(
    dbInstance: typeof db, metadata: ExportMetadata): Promise<TrainingsDataExport>
{
    const trainings: TrainingsDataExport = { sessions: [] };

    const trainingsExtraJoin = tTrainingsExtra.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoin();

    const participants = await dbInstance.selectFrom(tTrainingsAssignments)
        .innerJoin(tTrainings)
            .on(tTrainings.trainingId.equals(tTrainingsAssignments.assignmentTrainingId))
        .leftJoin(trainingsExtraJoin)
            .on(trainingsExtraJoin.trainingExtraId.equals(tTrainingsAssignments.assignmentExtraId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tTrainingsAssignments.assignmentUserId))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tTrainingsAssignments.assignmentUserId))
                .and(usersEventsJoin.eventId.equals(metadata.eventId))
                .and(usersEventsJoin.teamId.equalsIfValue(metadata.teamId))
        .where(tTrainingsAssignments.eventId.equals(metadata.eventId))
            .and(tTrainingsAssignments.assignmentConfirmed.equals(/* true= */ 1))
            .and(usersEventsJoin.teamId.equalsIfValue(metadata.teamId))
        .select({
            date: tTrainings.trainingStart,
            name: trainingsExtraJoin.trainingExtraName.valueWhenNull(usersJoin.name),
            email: trainingsExtraJoin.trainingExtraEmail.valueWhenNull(usersJoin.username),
            birthdate: trainingsExtraJoin.trainingExtraBirthdate.valueWhenNull(usersJoin.birthdate),
        })
        .orderBy('date', 'asc')
        .orderBy('name', 'asc')
        .executeSelectMany();

    let currentVolunteers: TrainingsDataExport['sessions'][number]['volunteers'] = [];
    let currentDate: string | null = null;

    for (const participant of participants) {
        const participationDate = formatDate(participant.date, 'YYYY-MM-DD');
        if (currentDate !== participationDate) {
            if (currentDate && currentVolunteers.length > 0)
                trainings.sessions.push({ date: currentDate, volunteers: currentVolunteers });

            currentDate = participationDate;
            currentVolunteers = [];
        }

        currentVolunteers.push({
            name: participant.name ?? '(unknown)',
            email: participant.email ?? 'crew@animecon.nl',
            birthdate: participant.birthdate ? participant.birthdate.toString() : '2030-01-01',
        });
    }

    if (currentDate && currentVolunteers.length > 0)
        trainings.sessions.push({ date: currentDate, volunteers: currentVolunteers });

    return trainings;
}

/**
 * Exports accepted volunteers and visible vendor personnel.
 */
async function exportVolunteers(
    dbInstance: typeof db, metadata: ExportMetadata): Promise<VolunteersDataExport>
{
    const volunteers: VolunteersDataExport = [];

    // What is the e-mail address that tickets for first aiders should be sent to?
    const firstAidEmailAddress =
        await readSetting('vendor-first-aid-email-address') ?? 'crew@animecon.nl';

    // Full names of volunteers who have already been seen in the list.
    const seenVolunteers = new Set<string>;

    // Whether the selected team (if relevant) manages any vendor teams.
    let managesFirstAid: boolean = true;
    let managesSecurity: boolean = true;

    if (!!metadata.teamId) {
        const settings = await dbInstance.selectFrom(tTeams)
            .where(tTeams.teamId.equals(metadata.teamId))
            .select({
                managesFirstAid: tTeams.teamFlagManagesFirstAid,
                managesSecurity: tTeams.teamFlagManagesSecurity,
            })
            .executeSelectNoneOrOne();

        managesFirstAid = !!settings?.managesFirstAid;
        managesSecurity = !!settings?.managesSecurity;
    }

    const volunteerList = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsersEventsPreferencesParticipation)
            .on(tUsersEventsPreferencesParticipation.userId.equals(tUsersEvents.userId))
                .and(tUsersEventsPreferencesParticipation.eventId.equals(tUsersEvents.eventId))
                .and(tUsersEventsPreferencesParticipation.preferenceVersionIsLatest.equals(1))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tUsersEvents.eventId.equals(metadata.eventId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(tUsersEvents.teamId.equalsIfValue(metadata.teamId))
        .select({
            department: tTeams.teamDepartment,
            role: tRoles.roleName,
            username: tUsers.username,
            firstName: tUsers.firstName,
            lastName: tUsers.lastName,
            gender: tUsers.gender,
            birthdate: tUsers.birthdate,
            shirtSize: tUsersEventsPreferencesParticipation.participationTshirtSize,
            shirtFit: tUsersEventsPreferencesParticipation.participationTshirtFit,
        })
        .orderBy(tRoles.roleOrder, 'asc')
        .orderBy(tUsers.lastName, 'asc')
        .orderBy(tUsers.firstName, 'asc')
        .executeSelectMany();

    const eventStartDay = metadata.eventStartTime.toPlainDate();
    for (const volunteer of volunteerList) {
        const age = volunteer.birthdate
            ? eventStartDay.since(volunteer.birthdate, { largestUnit: 'years' }).years
            : undefined;

        seenVolunteers.add(`${volunteer.firstName} ${volunteer.lastName}`);

        volunteers.push({
            department: volunteer.department ?? kDefaultDepartment,
            role: volunteer.role,
            email: volunteer.username!,
            firstName: volunteer.firstName,
            prefix: '',
            lastName: volunteer.lastName,
            gender: volunteer.gender,
            age,
            shirtSize: volunteer.shirtSize,
            shirtFit: volunteer.shirtFit,
        });
    }

    const vendorList = await dbInstance.selectFrom(tVendors)
        .where(tVendors.eventId.equals(metadata.eventId))
            .and(tVendors.vendorVisible.equals(/* true= */ 1))
            .and(tVendors.vendorTeam.equals(kVendorTeam.FirstAid))
        .select({
            team: tVendors.vendorTeam,
            firstName: tVendors.vendorFirstName,
            lastName: tVendors.vendorLastName,
            gender: tVendors.vendorGender,
            shirtFit: tVendors.vendorShirtFit,
            shirtSize: tVendors.vendorShirtSize,
        })
        .orderBy(tVendors.vendorLastName, 'asc')
        .orderBy(tVendors.vendorFirstName, 'asc')
        .executeSelectMany();

    const kVendorTeamToRoleMapping: { [k in VendorTeam]: string } = {
        [kVendorTeam.FirstAid]: 'First Aid',
        [kVendorTeam.Security]: 'Security',
    };

    for (const vendor of vendorList) {
        if (seenVolunteers.has(`${vendor.firstName} ${vendor.lastName}`))
            continue;  // they will already be receiving another ticket

        const managesVendorTeam =
            vendor.team === kVendorTeam.FirstAid ? managesFirstAid : managesSecurity;
        if (!managesVendorTeam)
            continue;

        volunteers.push({
            department: kDefaultDepartment,
            role: kVendorTeamToRoleMapping[vendor.team],
            email: firstAidEmailAddress,
            firstName: vendor.firstName,
            prefix: '',
            lastName: vendor.lastName,
            gender: vendor.gender,
            shirtSize: vendor.shirtSize,
            shirtFit: vendor.shirtFit,
        });
    }

    return volunteers;
}

/**
 * Exports WhatsApp contact details for opted-in volunteers.
 */
async function exportWhatsApp(
    dbInstance: typeof db, metadata: ExportMetadata): Promise<WhatsAppDataExport>
{
    const preferencesJoin = tUsersEventsPreferencesParticipation.forUseInLeftJoin();

    return dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .leftJoin(preferencesJoin)
            .on(preferencesJoin.userId.equals(tUsersEvents.userId))
            .and(preferencesJoin.eventId.equals(tUsersEvents.eventId))
            .and(preferencesJoin.preferenceVersionIsLatest.equals(1))
        .where(tUsersEvents.eventId.equals(metadata.eventId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(tUsersEvents.teamId.equalsIfValue(metadata.teamId))
            .and(preferencesJoin.participationIncludeSocialMedia.equals(/* true= */ 1))
        .select({
            role: tRoles.roleName,
            name: tUsers.name,
            phoneNumber: tUsers.phoneNumber.valueWhenNull('+31600000000'),
        })
        .orderBy(tRoles.roleOrder, 'asc')
        .orderBy('name', 'asc')
        .executeSelectMany();
}

/**
 * Server Action through which visitors with a valid export link can retrieve the exported data.
 */
export async function accessExport(formData: unknown) {
    return executeServerAction(formData, kAccessExportData, async (data, props) => {
        if (!props.ip)
            forbidden();

        const exportsLogsJoin = tExportsLogs.forUseInLeftJoin();

        const dbInstance = db;
        const metadata = await dbInstance.selectFrom(tExports)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tExports.exportEventId))
            .leftJoin(exportsLogsJoin)
                .on(exportsLogsJoin.exportId.equals(tExports.exportId))
            .where(tExports.exportSlug.equals(data.slug))
                .and(tExports.exportEnabled.equals(/* true= */ 1))
                .and(tExports.exportExpirationDate.greaterThan(dbInstance.currentZonedDateTime()))
            .select({
                id: tExports.exportId,
                eventId: tExports.exportEventId,
                eventName: tEvents.eventShortName,
                eventStartTime: tEvents.eventStartTime,
                eventEndTime: tEvents.eventEndTime,
                teamId: tExports.exportTeamId,
                type: tExports.exportType,

                maximumViews: tExports.exportExpirationViews,
                views: dbInstance.count(exportsLogsJoin.exportLogId),
            })
            .groupBy(tExports.exportId)
            .having(tExports.exportExpirationViews.greaterThan(
                dbInstance.count(exportsLogsJoin.exportLogId)))
            .executeSelectNoneOrOne();

        if (!metadata)
            return { success: false, error: 'The data is no longer available, please refresh' };

        if (await recordExportAccess(dbInstance, metadata.id, props.ip, props.user?.id)) {
            LogBuilder.for('AccessExport')
                .withInitiatorUser(props.user)
                .record({
                    event: metadata.eventName,
                    type: metadata.type,
                });
        }

        switch (metadata.type) {
            case kExportType.BuildUp:
                return { success: true, buildUp: await exportBuildUpOrTearDown(dbInstance, metadata) };
            case kExportType.TearDown:
                return { success: true, tearDown: await exportBuildUpOrTearDown(dbInstance, metadata) };
            case kExportType.Credits:
                return { success: true, credits: await exportCredits(dbInstance, metadata) };
            case kExportType.Discord:
                return { success: true, discord: await exportDiscord(dbInstance, metadata) };
            case kExportType.Refunds:
                return { success: true, refunds: await exportRefunds(dbInstance, metadata) };
            case kExportType.Trainings:
                return { success: true, trainings: await exportTrainings(dbInstance, metadata) };
            case kExportType.Volunteers:
                return { success: true, volunteers: await exportVolunteers(dbInstance, metadata) };
            case kExportType.WhatsApp:
                return { success: true, whatsapp: await exportWhatsApp(dbInstance, metadata) };
        }
    }, /* allowVisitors= */ true);
}
