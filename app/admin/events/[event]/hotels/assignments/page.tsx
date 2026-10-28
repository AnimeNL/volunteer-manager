// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import HotelIcon from '@mui/icons-material/Hotel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import type { HotelCommunicationCellContext } from './HotelAssignmentCells';
import { BooleanCell, BooleanHeader } from '@app/admin/components/DataTable/cells/BooleanCell';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { HotelCommunicationCell, HotelCommunicationHeaderCell, HotelOccupantCell }
    from './HotelAssignmentCells';
import { LogBuilder } from '@lib/log/index';
import { PendingAssignmentsSection } from './PendingAssignmentsSection';
import { PreferenceHistorySection } from './PreferenceHistorySection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { compileDateWarnings } from './compileDateWarnings';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { processVolunteerCommunication } from '../../[team]/volunteers/dataSource';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tHotels, tHotelsBookings, tRoles, tTeams, tUsers, tUsersCommunication, tUsersEvents }
    from '@lib/database';

import { kCommunicationLanguage, kRegistrationStatus } from '@lib/database/Types';
import { kEventTransformer } from '@app/admin/components/DataTable';

import { sendHotelConfirmationCommunication } from '../HotelsActions';

/**
 * Individual hotel assignment, either as a volunteer (`number`) or as an invitee (`string`).
 */
type HotelAssignment = number | string;

/**
 * Determines the intended assignments based on the given `row`. Only names will be consumed, which
 * will automatically be linked to users when they participate in the given `eventId`.
 */
async function determineAssignmentsFromRow(
    eventId: number,
    row: { firstName?: string | null; secondName?: string | null; thirdName?: string | null })
{
    const assignments: HotelAssignment[] = [];

    const names = [ row.firstName, row.secondName, row.thirdName ].filter(
        (name): name is string => !!name && name.trim().length > 0);
    if (!names.length)
        return assignments;

    const users = await db.selectFrom(tUsers)
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.userId.equals(tUsers.userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.registrationStatus.in([
                    kRegistrationStatus.Accepted,
                    kRegistrationStatus.Cancelled,
                ]))
        .where(tUsers.name.in(names))
        .select({
            userId: tUsers.userId,
            name: tUsers.name,
        })
        .executeSelectMany();

    const userMap = new Map(users.map(u => [ u.name, u.userId ]));
    for (const assignedName of names) {
        const userId = userMap.get(assignedName);
        assignments.push(userId ?? assignedName);
    }

    return assignments;
}

/**
 * Data source for managing the hotel room assignments for an event.
 */
const assignmentsDataSource = createDataSource('admin/event/hotels/assignments', withContext({
    /**
     * Event for which hotel room assignments are being managed.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of this booking in the database.
     */
    id: z.number(),

    /**
     * Name, user ID, team and communication metadata of the booking's first occupant.
     */
    firstName: z.string().nullish(),
    firstUserId: z.number().nullish(),
    firstTeam: z.string().nullish(),
    firstTeamId: z.number().nullish(),
    firstLanguage: z.enum(kCommunicationLanguage).nullish(),
    firstCommunication: z.record(z.string(), z.string()).optional(),

    /**
     * Name, user ID, team and communication metadata of the booking's second occupant.
     */
    secondName: z.string().nullish(),
    secondUserId: z.number().nullish(),
    secondTeam: z.string().nullish(),
    secondTeamId: z.number().nullish(),
    secondLanguage: z.enum(kCommunicationLanguage).nullish(),
    secondCommunication: z.record(z.string(), z.string()).optional(),

    /**
     * Name, user ID, team and communication metadata of the booking's third occupant.
     */
    thirdName: z.string().nullish(),
    thirdUserId: z.number().nullish(),
    thirdTeam: z.string().nullish(),
    thirdTeamId: z.number().nullish(),
    thirdLanguage: z.enum(kCommunicationLanguage).nullish(),
    thirdCommunication: z.record(z.string(), z.string()).optional(),

    /**
     * ID and formatted label of the hotel room option associated with this booking.
     */
    hotelId: z.number().nullish(),
    hotelDescription: z.string().nullish(),

    /**
     * Date (YYYY-MM-DD) on which the assignees will be checking in.
     */
    checkIn: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/),

    /**
     * Date (YYYY-MM-DD) on which the assignees will be checking out.
     */
    checkOut: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/),

    /**
     * Whether the hotel booking has been confirmed.
     */
    confirmed: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.hotels',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async create(partialRow, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        if (!partialRow.firstName || !partialRow.hotelId || !partialRow.checkIn ||
            !partialRow.checkOut)
        {
            return false;  // required columns
        }

        const assignments = await determineAssignmentsFromRow(context.event.id, partialRow);

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tHotelsBookings)
            .set({
                eventId: context.event.id,
                bookingHotelId: partialRow.hotelId,
                bookingCheckIn: Temporal.PlainDate.from(partialRow.checkIn),
                bookingCheckOut: Temporal.PlainDate.from(partialRow.checkOut),
                bookingFirstUserId: typeof assignments[0] === 'number' ? assignments[0] : null,
                bookingFirstName: typeof assignments[0] === 'string' ? assignments[0] : null,
                bookingSecondUserId: typeof assignments[1] === 'number' ? assignments[1] : null,
                bookingSecondName: typeof assignments[1] === 'string' ? assignments[1] : null,
                bookingThirdUserId: typeof assignments[2] === 'number' ? assignments[2] : null,
                bookingThirdName: typeof assignments[2] === 'string' ? assignments[2] : null,
                bookingConfirmed: partialRow.confirmed ? dbInstance.currentZonedDateTime() : null,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateHotelBooking')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .withAffectedUser(typeof assignments[0] === 'number' ? assignments[0] : undefined)
            .record({
                event: context.event.shortName,
                owner: partialRow.firstName,
            });

        return !!insertId;
    },

    async delete(row, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tHotelsBookings)
            .set({
                bookingDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tHotelsBookings.bookingId.equals(row.id))
                .and(tHotelsBookings.eventId.equals(context.event.id))
                .and(tHotelsBookings.bookingDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('DeleteHotelBooking')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(row.firstUserId ?? undefined)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                owner: row.firstName || 'Unassigned',
            });

        return !!affectedRows;
    },

    async list(params, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        const firstUserJoin = tUsers.forUseInLeftJoinAs('fu');
        const secondUserJoin = tUsers.forUseInLeftJoinAs('su');
        const thirdUserJoin = tUsers.forUseInLeftJoinAs('tu');

        const hotelsJoin = tHotels.forUseInLeftJoin();

        const sortField =
            params.sort.field === 'hotelId' ? 'hotelName' : (params.sort.field ?? 'firstName');

        const dbInstance = db;
        const bookings = await dbInstance.selectFrom(tHotelsBookings)
            .leftJoin(hotelsJoin)
                .on(hotelsJoin.hotelId.equals(tHotelsBookings.bookingHotelId))
            .leftJoin(firstUserJoin)
                .on(firstUserJoin.userId.equals(tHotelsBookings.bookingFirstUserId))
            .leftJoin(secondUserJoin)
                .on(secondUserJoin.userId.equals(tHotelsBookings.bookingSecondUserId))
            .leftJoin(thirdUserJoin)
                .on(thirdUserJoin.userId.equals(tHotelsBookings.bookingThirdUserId))
            .where(tHotelsBookings.eventId.equals(context.event.id))
                .and(tHotelsBookings.bookingDeleted.isNull())
            .select({
                id: tHotelsBookings.bookingId,

                firstName: tHotelsBookings.bookingFirstName.valueWhenNull(firstUserJoin.name),
                firstUserId: tHotelsBookings.bookingFirstUserId,
                firstLanguage: firstUserJoin.language,

                secondName: tHotelsBookings.bookingSecondName.valueWhenNull(secondUserJoin.name),
                secondUserId: tHotelsBookings.bookingSecondUserId,
                secondLanguage: secondUserJoin.language,

                thirdName: tHotelsBookings.bookingThirdName.valueWhenNull(thirdUserJoin.name),
                thirdUserId: tHotelsBookings.bookingThirdUserId,
                thirdLanguage: thirdUserJoin.language,

                hotelId: tHotelsBookings.bookingHotelId,
                hotelName: hotelsJoin.hotelName,
                roomName: hotelsJoin.hotelRoomName,

                checkIn: dbInstance.dateAsString(tHotelsBookings.bookingCheckIn),
                checkOut: dbInstance.dateAsString(tHotelsBookings.bookingCheckOut),
                confirmed: tHotelsBookings.bookingConfirmed.isNotNull(),
            })
            .orderBy('confirmed', 'desc')
                .orderBy(sortField as any, params.sort.direction)
                .orderBy('checkIn', 'asc')
                .orderBy('checkOut', 'asc')
                .orderBy('id', 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        const userIds = new Set<number>();
        for (const booking of bookings.data) {
            if (booking.firstUserId)
                userIds.add(booking.firstUserId);
            if (booking.secondUserId)
                userIds.add(booking.secondUserId);
            if (booking.thirdUserId)
                userIds.add(booking.thirdUserId);
        }

        const volunteers = new Map<number, {
            communication: Record<string, string>;
            team: string;
            teamId: number;
        }>();

        if (userIds.size > 0) {
            const usersCommunicationJoin = tUsersCommunication.forUseInLeftJoin();

            const volunteerData = await dbInstance.selectFrom(tUsersEvents)
                .innerJoin(tRoles)
                    .on(tRoles.roleId.equals(tUsersEvents.roleId))
                .innerJoin(tTeams)
                    .on(tTeams.teamId.equals(tUsersEvents.teamId))
                .leftJoin(usersCommunicationJoin)
                    .on(usersCommunicationJoin.userId.equals(tUsersEvents.userId))
                        .and(usersCommunicationJoin.communicationEventId.equals(
                            tUsersEvents.eventId))
                        .and(usersCommunicationJoin.communicationPromptId.in([
                            'hotel-confirmation',
                            'hotel-payment-reminder',
                        ]))
                .where(tUsersEvents.eventId.equals(context.event.id))
                    .and(tUsersEvents.userId.in([ ...userIds ]))
                    .and(tUsersEvents.registrationStatus.in([
                        kRegistrationStatus.Accepted,
                        kRegistrationStatus.Cancelled,
                    ]))
                .select({
                    userId: tUsersEvents.userId,
                    team: tTeams.teamSlug,
                    teamId: tTeams.teamId,
                    accepted: tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted),
                    eligible: tUsersEvents.hotelEligible.valueWhenNull(tRoles.roleHotelEligible),
                    communication: dbInstance.aggregateAsArray({
                        promptId: usersCommunicationJoin.communicationPromptId,
                        date: usersCommunicationJoin.communicationDate,
                    }),
                })
                .groupBy(tUsersEvents.userId, tUsersEvents.teamId)
                .orderBy('accepted', 'asc')
                    .orderBy('eligible', 'asc')
                .executeSelectMany();

            for (const volunteer of volunteerData) {
                volunteers.set(volunteer.userId, {
                    ...volunteer,
                    communication: processVolunteerCommunication(volunteer.communication),
                });
            }
        }

        return {
            rowCount: bookings.count,
            rows: bookings.data.map(booking => {
                const firstVolunteer =
                    booking.firstUserId ? volunteers.get(booking.firstUserId) : undefined;
                const secondVolunteer =
                    booking.secondUserId ? volunteers.get(booking.secondUserId) : undefined;
                const thirdVolunteer =
                    booking.thirdUserId ? volunteers.get(booking.thirdUserId) : undefined;

                return {
                    ...booking,
                    firstTeam: firstVolunteer?.team,
                    firstTeamId: firstVolunteer?.teamId,
                    firstCommunication: firstVolunteer?.communication,

                    secondTeam: secondVolunteer?.team,
                    secondTeamId: secondVolunteer?.teamId,
                    secondCommunication: secondVolunteer?.communication,

                    thirdTeam: thirdVolunteer?.team,
                    thirdTeamId: thirdVolunteer?.teamId,
                    thirdCommunication: thirdVolunteer?.communication,

                    hotelDescription:
                        booking.hotelName && booking.roomName
                            ? `${booking.hotelName} (${booking.roomName})`
                            : 'Unassigned',
                    confirmed: !!booking.confirmed,
                };
            }),
        };
    },

    async update(row, previousRow, props, context) {
        if (!context.event.flags.enableHotel)
            notFound();

        const updatedAssignments = await determineAssignmentsFromRow(context.event.id, row);

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tHotelsBookings)
            .set({
                bookingHotelId: row.hotelId ?? null,
                bookingCheckIn: Temporal.PlainDate.from(row.checkIn),
                bookingCheckOut: Temporal.PlainDate.from(row.checkOut),

                bookingFirstUserId:
                    typeof updatedAssignments[0] === 'number' ? updatedAssignments[0] : null,
                bookingFirstName:
                    typeof updatedAssignments[0] === 'string' ? updatedAssignments[0] : null,

                bookingSecondUserId:
                    typeof updatedAssignments[1] === 'number' ? updatedAssignments[1] : null,
                bookingSecondName:
                    typeof updatedAssignments[1] === 'string' ? updatedAssignments[1] : null,

                bookingThirdUserId:
                    typeof updatedAssignments[2] === 'number' ? updatedAssignments[2] : null,
                bookingThirdName:
                    typeof updatedAssignments[2] === 'string' ? updatedAssignments[2] : null,

                bookingConfirmed:
                    previousRow.confirmed !== row.confirmed
                        ? (row.confirmed ? dbInstance.currentZonedDateTime() : null)
                        : undefined,
            })
            .where(tHotelsBookings.bookingId.equals(row.id))
                .and(tHotelsBookings.eventId.equals(context.event.id))
                .and(tHotelsBookings.bookingDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateHotelBooking')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(
                typeof updatedAssignments[0] === 'number'
                    ? updatedAssignments[0]
                    : (previousRow.firstUserId ?? undefined))
            .record({
                event: context.event.shortName,
                owner: row.firstName || previousRow.firstName || 'Unassigned',
            });

        return !!affectedRows;
    },
});

/**
 * The <EventHotelAssignmentsPage> page allows event administrators to view and manage hotel room
 * assignments for volunteers participating in a particular event.
 */
export default async function EventHotelAssignmentsPage(
    props: PageProps<'/admin/events/[event]/hotels/assignments'>)
{
    const { event, user } = await requireAuthenticationWithEvent(props, 'event.hotels');
    if (!event.flags.enableHotel)
        notFound();

    const hotels = await db.selectFrom(tHotels)
        .where(tHotels.eventId.equals(event.id))
            .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
            .and(tHotels.hotelRoomDeleted.isNull())
        .select({
            id: tHotels.hotelId,
            hotelName: tHotels.hotelName,
            roomName: tHotels.hotelRoomName,
        })
        .orderBy(tHotels.hotelName, 'asc')
            .orderBy(tHotels.hotelRoomName, 'asc')
        .executeSelectMany();

    const rooms = hotels.map(hotel => ({
        value: hotel.id,
        label: `${hotel.hotelName} (${hotel.roomName})`,
    }));

    const columns: Column<ExtractRowModel<typeof assignmentsDataSource>>[] = [
        {
            field: 'firstName',
            headerName: 'Booking owner',
            editable: true,
            sortable: true,
            flex: 1,

            template: 'component',
            templateProps: {
                component: HotelOccupantCell,
                componentContext: {
                    event: event.slug,
                    occupant: 'first',
                },
            },

            editorProps: {
                required: true,
            },
        },
        {
            field: 'secondName',
            headerName: 'Second guest',
            editable: true,
            sortable: false,
            flex: 1,

            template: 'component',
            templateProps: {
                component: HotelOccupantCell,
                componentContext: {
                    event: event.slug,
                    occupant: 'second',
                },
            },
        },
        {
            field: 'thirdName',
            headerName: 'Third guest',
            editable: true,
            sortable: false,
            flex: 1,

            template: 'component',
            templateProps: {
                component: HotelOccupantCell,
                componentContext: {
                    event: event.slug,
                    occupant: 'third',
                },
            },
        },
        {
            field: 'hotelId',
            headerName: 'Hotel room',
            editable: true,
            sortable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: rooms,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'checkIn',
            headerName: 'Check in',
            editable: true,
            sortable: true,
            width: 125,

            template: 'date',

            editorProps: {
                placeholder: 'YYYY-MM-DD',
                required: true,
            },
        },
        {
            field: 'checkOut',
            headerName: 'Check out',
            editable: true,
            sortable: true,
            width: 125,

            template: 'date',

            editorProps: {
                placeholder: 'YYYY-MM-DD',
                required: true,
            },
        },
        {
            field: 'confirmed',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            description: 'Has this room been booked?',
            editable: true,
            sortable: true,
            width: 50,

            type: 'boolean',

            template: 'component',
            templateProps: {
                component: BooleanCell,
                componentContext: {
                    field: 'confirmed',
                    tooltips: {
                        header: 'Has the hotel room been booked?',
                        falsyValue: 'Booking has not been confirmed',
                        truthyValue: 'Booking has been confirmed',
                    },
                },
                headerComponent: BooleanHeader,
            },
        },
        {
            field: 'hotelDescription',  // unrelated
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            editable: false,
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                component: HotelCommunicationCell,
                componentContext: {
                    action: sendHotelConfirmationCommunication.bind(null, event.slug),
                    eventId: event.id,
                } satisfies HotelCommunicationCellContext,
                headerComponent: HotelCommunicationHeaderCell,
            },
        },
    ];

    const warnings = await compileDateWarnings(event.id);

    return (
        <>
            <Section icon={ <HotelIcon color="primary" /> } title="Hotel assignments"
                     documentation="event/hotels"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Hotels', href: `/admin/events/${event.slug}/hotels` },
                         { label: 'Assignments' },
                     ]}>
                <SectionIntroduction>
                    Hotel room assignments and pending requests for {event.shortName} volunteers.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={assignmentsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'firstName', sort: 'asc' }}
                           disableFooter pageSize={100} refreshOnMutation subject="hotel booking"
                           listViewProps={{
                               primaryField: 'firstName',
                               secondaryTemplate: '{hotelDescription} ({checkIn} – {checkOut})',
                               startComponent: BooleanCell,
                               startComponentContext: { field: 'confirmed' },
                           }} />
                <Collapse in={warnings.length > 0}>
                    <Alert severity="warning" variant="outlined">
                        <Stack direction="column" spacing={0} sx={{ maxWidth: '100%' }}>
                            { warnings.map(({ volunteer, warning }, index) =>
                                <Typography key={index} variant="body2">
                                    <strong>{volunteer}</strong> {warning}
                                </Typography> )}
                        </Stack>
                    </Alert>
                </Collapse>
            </Section>
            <PendingAssignmentsSection event={event} userId={user.id} />
            <PreferenceHistorySection event={event.slug} userId={user.id} />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Assignments', 'Hotels', { event: 'event' });
