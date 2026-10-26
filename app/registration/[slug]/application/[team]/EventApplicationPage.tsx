// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Box from '@mui/material/Box';
import EventNoteIcon from '@mui/icons-material/EventNote';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import MuiLink from '@mui/material/Link';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import type { EnvironmentContext, EnvironmentContextEventAccess } from '@lib/EnvironmentContext';
import type { RegistrationStatus } from '@lib/database/Types';
import type { User } from '@lib/auth/User';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';
import { formatDate, isAfter, isBefore } from '@lib/Temporal';
import db, { tEvents, tHotels, tHotelsBookings, tRefunds, tRoles, tTrainings,
    tTrainingsAssignments, tUsersEvents, tUsersEventsPreferencesHotel,
    tUsersEventsPreferencesRefunds, tUsersEventsPreferencesTraining } from '@lib/database';

import { kEventAvailabilityStatus, kRegistrationStatus } from '@lib/database/Types';

type WindowStatus =
    undefined | { enabled: boolean; status: 'pending' | 'missed'; secondary: string };

/**
 * Determines the status of the given `availabilityWindow` in relation to the current time. When the
 * item is not available due to the availability window being closed, a message with as many details
 * as we can share will be shown instead.
 */
function determineAvailabilityWindowStatus(
    availabilityWindow?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime } | null)
        : WindowStatus
{
    // Case (1): No availability window has been defined at all.
    if (!availabilityWindow || (!availabilityWindow.start && !availabilityWindow.end)) {
        return {
            enabled: false,
            status: 'pending',
            secondary: 'We\'re not ready to note down your preferences yet…',
        };
    }

    const now = Temporal.Now.instant();

    // Case (2a): The availability window's start date may be in the future.
    if (!!availabilityWindow.start) {
        const start = availabilityWindow.start;

        if (Temporal.Instant.compare(start.toInstant(), now) > 0) {
            return {
                enabled: false,
                status: 'pending',
                secondary: `Share your preferences from ${formatDate(start, 'MMMM Do')}…`,
            };
        }
    }

    // Case (2b): The availability window's end date may be in the past.
    if (!!availabilityWindow.end) {
        const end = availabilityWindow.end;

        if (Temporal.Instant.compare(end.toInstant(), now) <= 0) {
            return {
                enabled: true,
                status: 'missed',
                secondary: `Planning completed on ${formatDate(end, 'MMMM Do')}—please contact us…`,
            };
        }
    }

    return undefined;
}

/**
 * Props accepted by the <StatusButton> layout component.
 */
interface StatusButtonProps {
    /**
     * Whether interaction with the button should be disabled.
     */
    disabled?: boolean;

    /**
     * URL the button should link to when clicked.
     */
    href: string;

    /**
     * Warning message to show in a tooltip when access is granted through an override.
     */
    overrideWarning?: string;

    /**
     * Primary text to display on the button.
     */
    primary?: string;

    /**
     * Secondary text to display below the primary text.
     */
    secondary?: string;

    /**
     * Visual completion status of the step represented by the button.
     */
    status: 'confirmed' | 'submitted' | 'pending' | 'missed';
}

/**
 * Renders a list item button with a status icon and an optional permission override indicator.
 */
function StatusButton(props: StatusButtonProps) {
    const { disabled, href, overrideWarning, primary, secondary, status } = props;

    return (
        <ListItemButton LinkComponent={Link} sx={{ pl: 4 }} disabled={disabled} href={href}>
            <ListItemIcon>
                { status === 'confirmed' && <TaskAltIcon color="success" /> }
                { status === 'submitted' && <RadioButtonUncheckedIcon color="success" /> }
                { status === 'pending' && <RadioButtonUncheckedIcon color="warning" /> }
                { status === 'missed' && <RadioButtonUncheckedIcon color="error" /> }
            </ListItemIcon>
            <ListItemText primary={primary} secondary={secondary} />
            { !!overrideWarning &&
                <Tooltip title={overrideWarning}>
                    <TooltipIconWrapper>
                        <VisibilityOffIcon color="warning" sx={{ mr: 2 }} />
                    </TooltipIconWrapper>
                </Tooltip> }
        </ListItemButton>
    );
}

/**
 * Props shared by the individual application status button components.
 */
interface ApplicationStatusButtonProps {
    /**
     * Base URL for linking the button to an appropriate location.
     */
    baseUrl: string;

    /**
     * Context about the environment for which this page is being displayed.
     */
    context: EnvironmentContext;

    /**
     * Event for which this page is being displayed.
     */
    event: EnvironmentContextEventAccess;

    /**
     * Unique ID of the team the volunteer has joined.
     */
    teamId: number;

    /**
     * URL-safe slug that represents the team for this application.
     */
    teamSlug: string;

    /**
     * The user who is currently signed in.
     */
    user: User;
}

/**
 * The <AvailabilityButton> component displays the status of the volunteer's availability, both in
 * regards to their presence at the location and events they would like to attend.
 *
 * This button deals with a number of situations:
 *   (1) The volunteer is able to see their preferences, but can't change them.
 *   (2) The volunteer is able to indicate their preferences.
 *   (3) The volunteer is not able to indicate their preferences yet.
 */
async function AvailabilityButton(props: ApplicationStatusButtonProps) {
    const { context, event, teamSlug } = props;

    const status = await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .selectOneColumn(tEvents.eventAvailabilityStatus)
        .executeSelectNoneOrOne();

    const enabled =
        status === kEventAvailabilityStatus.Available || status === kEventAvailabilityStatus.Locked;
    const override = context.access.can('event.visible', {
        event: event.slug,
        team: teamSlug,
    });

    let buttonStatus: StatusButtonProps['status'];
    let primary: string;
    let secondary: string;

    if (status === kEventAvailabilityStatus.Locked) {
        // (1) The volunteer is able to see their preferences, but can't change them.
        primary = 'When will you be around during the festival?';
        secondary = 'Your preferences have been noted!';
        buttonStatus = 'confirmed';
    } else if (status === kEventAvailabilityStatus.Available) {
        // (2) The volunteer is able to indicate their preferences.
        primary = 'When will you be around during the festival?';
        secondary = 'Please share your preferences at your convenience!';
        buttonStatus = 'submitted';
    } else {
        // (3) The volunteer is not able to indicate their preferences yet.
        primary = 'When will you be around during the festival?';
        secondary = 'The program has not been published yet…';
        buttonStatus = 'pending';
    }

    return (
        <StatusButton disabled={!enabled && !override} href={`${props.baseUrl}/availability`}
                      overrideWarning={
                          (!enabled && override) ? 'Access is limited to event managers' : undefined
                      }
                      primary={primary} secondary={secondary} status={buttonStatus} />
    );
}

/**
 * The <HotelStatusButton> component displays the status of the volunteer's hotel room preferences
 * and booking(s). This is a multi-step process involving quite a lot of manual back-and-forth.
 *
 * This button deals with a number of situations:
 *   (1) The volunteer has one or more confirmed hotel room bookings.
 *   (2) The volunteer indicated their preferences, wants a room and is awaiting confirmation.
 *   (3) The volunteer indicated their preferences and does not want a room.
 *   (4) The volunteer is able to indicate their preferences, but has not done so yet.
 *   (5) The information regarding hotel room availability has not been published yet.
 *   (6) The availability window for hotel room preferences has not opened yet.
 *
 * It's possible for a volunteer to have more than one hotel room booking, significant because there
 * might be a different booking for e.g. Thursday to Friday compared to Friday to Sunday.
 */
async function HotelStatusButton(props: ApplicationStatusButtonProps) {
    const { context, event, teamId, user } = props;

    const hotelBookingRoomJoin = tHotels.forUseInLeftJoinAs('hbr');
    const hotelBookingsJoin = tHotelsBookings.forUseInLeftJoin();
    const hotelPreferenceRoomJoin = tHotels.forUseInLeftJoinAs('hpr');
    const preferencesHotelJoin = tUsersEventsPreferencesHotel.forUseInLeftJoin();

    const dbInstance = db;
    const data = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
                .and(tEvents.hotelEnabled.equals(/* true= */ 1))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .leftJoin(preferencesHotelJoin)
            .on(preferencesHotelJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesHotelJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesHotelJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
        .leftJoin(hotelPreferenceRoomJoin)
            .on(hotelPreferenceRoomJoin.hotelId.equals(preferencesHotelJoin.hotelRoomId))
        .leftJoin(hotelBookingsJoin)
            .on(hotelBookingsJoin.eventId.equals(tUsersEvents.eventId))
                .and(hotelBookingsJoin.bookingConfirmed.isNotNull())
                .and(hotelBookingsJoin.bookingDeleted.isNull())
                .and(hotelBookingsJoin.bookingFirstUserId.equals(tUsersEvents.userId).or(
                    hotelBookingsJoin.bookingSecondUserId.equals(tUsersEvents.userId)).or(
                    hotelBookingsJoin.bookingThirdUserId.equals(tUsersEvents.userId)))
        .leftJoin(hotelBookingRoomJoin)
            .on(hotelBookingRoomJoin.hotelId.equals(hotelBookingsJoin.bookingHotelId))
        .where(tUsersEvents.userId.equals(user.id))
            .and(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(teamId))
        .select({
            availabilityWindow: {
                start: tEvents.hotelPreferencesStart,
                end: tEvents.hotelPreferencesEnd,
            },
            bookings: dbInstance.aggregateAsArray({
                checkIn: hotelBookingsJoin.bookingCheckIn,
                checkOut: hotelBookingsJoin.bookingCheckOut,
                hotelName: hotelBookingRoomJoin.hotelName,
            }),
            eligible: tUsersEvents.hotelEligible.valueWhenNull(
                tRoles.roleHotelEligible).equals(/* true= */ 1),
            informationPublished: tEvents.hotelInformationPublished.equals(/* true= */ 1),
            preferences: {
                hotelName: hotelPreferenceRoomJoin.hotelName,
                updated: preferencesHotelJoin.preferenceVersion,
            },
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!data)
        return undefined;

    const { availabilityWindow, bookings, preferences } = data;
    if (!data.eligible && !preferences && !bookings.length)
        return undefined;

    const override = context.access.can('event.hotels', { event: event.slug });

    let enabled = data.informationPublished;

    let status: StatusButtonProps['status'] = 'pending';
    let primary: string | undefined;
    let secondary: string | undefined;

    // (1) The volunteer has one or more confirmed hotel room bookings.
    if (bookings.length > 0) {
        enabled = true;
        status = 'confirmed';

        let hotel: string;
        if (bookings.length > 1) {
            hotel = ` ${bookings.length} different rooms`;
            primary = `You've got ${bookings.length} confirmed hotel room bookings`;
        } else {
            hotel = ` the ${bookings[0].hotelName}`;
            primary = 'Your hotel room has been confirmed!';
        }

        let earliestCheckIn = Temporal.PlainDate.from('2099-12-31');
        let latestCheckOut = Temporal.PlainDate.from('1999-01-01');

        for (const booking of bookings) {
            if (!booking.checkIn || !booking.checkOut)
                continue;

            if (isAfter(earliestCheckIn, booking.checkIn))
                earliestCheckIn = booking.checkIn;
            if (isBefore(latestCheckOut, booking.checkOut))
                latestCheckOut = booking.checkOut;
        }

        secondary  = `${formatDate(earliestCheckIn, 'dddd')} until `;
        secondary += `${formatDate(latestCheckOut, 'dddd')}, in`;
        secondary += hotel;
    } else if (!!preferences) {
        // (2) The volunteer indicated their preferences, wants a room and is awaiting confirmation.
        if (!!preferences.hotelName) {
            status = 'submitted';
            primary = `You've requested a room in the ${preferences.hotelName}`;
            secondary = 'We\'ll confirm the reservation closer to the convention';

        // (3) The volunteer indicated their preferences and does not want a room.
        } else {
            status = 'confirmed';
            primary = 'You don\'t need a hotel room booking';
        }
    } else {
        const availabilityWindowStatus = determineAvailabilityWindowStatus(availabilityWindow);

        // (4) The volunteer is able to indicate their preferences, but has not done so yet.
        primary = 'Do you want to reserve a hotel room?';

        // (5) The volunteer is not able to indicate their preferences yet.
        if (!enabled) {
            secondary = 'Hotel information has not been published yet…';

        // (6) The availability window for hotel room preferences has not opened yet.
        } else if (!!availabilityWindowStatus) {
            enabled = availabilityWindowStatus.enabled;
            secondary = availabilityWindowStatus.secondary;
            status = availabilityWindowStatus.status;
        }
    }

    return (
        <StatusButton disabled={!enabled && !override} href={`${props.baseUrl}/hotel`}
                      overrideWarning={
                          (!enabled && override)
                              ? 'Access is limited to hotel booking managers'
                              : undefined
                      }
                      primary={primary} secondary={secondary} status={status} />
    );
}

/**
 * The <RefundStatusButton> component displays the volunteer's ability to request a refund for the
 * ticket they purchased in the past event. Visibility of this button is separate from accessibility
 * of the page, as is covered in our data and privacy policies.
 *
 * This button deals with a number of situations:
 *   (1) The volunteer has been issued a refund.
 *   (2) The volunteer has requested a refund.
 *   (3) The volunteer is able to request a refund.
 *   (4) The volunteer is able to request a refund because of an override.
 */
async function RefundStatusButton(props: ApplicationStatusButtonProps) {
    const { context, event, user } = props;

    const refundsJoin = tRefunds.forUseInLeftJoin();
    const refundsPreferencesJoin = tUsersEventsPreferencesRefunds.forUseInLeftJoin();

    const data = await db.selectFrom(tEvents)
        .leftJoin(refundsPreferencesJoin)
            .on(refundsPreferencesJoin.eventId.equals(tEvents.eventId))
                .and(refundsPreferencesJoin.userId.equals(user.id))
                .and(refundsPreferencesJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
        .leftJoin(refundsJoin)
            .on(refundsJoin.eventId.equals(tEvents.eventId))
                .and(refundsJoin.userId.equals(user.id))
        .where(tEvents.eventId.equals(event.id))
            .and(tEvents.refundEnabled.equals(/* true= */ 1))
        .select({
            availabilityWindow: {
                start: tEvents.refundRequestsStart,
                end: tEvents.refundRequestsEnd,
            },
            informationPublished: tEvents.refundInformationPublished.equals(/* true= */ 1),
            refund: {
                confirmed: refundsJoin.refundConfirmed,
                requested: refundsPreferencesJoin.preferenceVersion,
            },
        })
        .groupBy(tEvents.eventId)
        .executeSelectNoneOrOne();

    if (!data)
        return undefined;

    const { availabilityWindow, refund } = data;
    const override = context.access.can('volunteers.refunds', { event: event.slug });

    if (!refund && !data.informationPublished && !override)
        return undefined;

    let enabled = data.informationPublished;

    let status: StatusButtonProps['status'] = 'confirmed';
    let primary: string | undefined;
    let secondary: string | undefined;

    // TODO: Consider refund.confirmedBy in the user interface?

    if (!!refund) {
        // (1) The volunteer has been issued a refund.
        if (!!refund.confirmed) {
            const confirmationDate = formatDate(
                refund.confirmed.withTimeZone(event.timeZone), 'dddd, MMMM D');

            primary = 'Your ticket has been refunded!';
            secondary = `We issued your refund on ${confirmationDate}`;
        }

        // (2) The volunteer has requested a refund.
        else {
            primary = 'You have requested a ticket refund';
            secondary = 'We\'ve received your request and will confirm it soon';
        }
    } else {
        const availabilityWindowStatus = determineAvailabilityWindowStatus(availabilityWindow);

        // (3) The volunteer is able to request a refund.
        // (4) The volunteer is able to request a refund because of an override.
        primary = 'You will receive a free ticket next year!';
        secondary = 'Thank you for your help—you could request a refund';

        if (!!availabilityWindowStatus) {
            enabled = availabilityWindowStatus.enabled;
            secondary = availabilityWindowStatus.secondary;
            status = availabilityWindowStatus.status;
        }
    }

    return (
        <StatusButton href={`${props.baseUrl}/refund`}
                      overrideWarning={
                          (!enabled && override)
                              ? 'Visibility is limited to refund managers'
                              : undefined
                      }
                      primary={primary} secondary={secondary} status={status} />
    );
}

/**
 * The <TrainingStatusButton> component displays the volunteer's participation in the training
 * sessions organised for the Stewards. This is a multi-step process involving back and forth.
 *
 * This button deals with a number of situations:
 *   (1) The volunteer has a confirmed spot in one of the sessions.
 *   (2) The volunteer indicated their preferences and is confirmed to not to participate.
 *   (3) The volunteer indicated their preferences, wants to join and waits for confirmation.
 *   (4) The volunteer indicated their preferences and does not want to participate.
 *   (5) The volunteer is able to indicate their preferences, but has not done so yet.
 *   (6) The information regarding training sessions has not been published yet.
 *   (7) The availability window for training preferences has not opened yet.
 *
 * Volunteers can only join a single training session. It's possible for seniors to join multiple
 * training sessions, but we'll handle those out-of-bounds.
 */
async function TrainingStatusButton(props: ApplicationStatusButtonProps) {
    const { context, event, teamId, user } = props;

    const preferencesTrainingJoin = tUsersEventsPreferencesTraining.forUseInLeftJoin();
    const trainingsAssignedJoin = tTrainings.forUseInLeftJoinAs('ta');
    const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();
    const trainingsPreferenceJoin = tTrainings.forUseInLeftJoinAs('tp');

    const data = await db.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
                .and(tEvents.trainingEnabled.equals(/* true= */ 1))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .leftJoin(preferencesTrainingJoin)
            .on(preferencesTrainingJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesTrainingJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesTrainingJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
        .leftJoin(trainingsPreferenceJoin)
            .on(trainingsPreferenceJoin.trainingId.equals(preferencesTrainingJoin.trainingId))
        .leftJoin(trainingsAssignmentsJoin)
            .on(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
                .and(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(trainingsAssignedJoin)
            .on(trainingsAssignedJoin.trainingId.equals(
                trainingsAssignmentsJoin.assignmentTrainingId))
        .where(tUsersEvents.userId.equals(user.id))
            .and(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(teamId))
        .select({
            availabilityWindow: {
                start: tEvents.trainingPreferencesStart,
                end: tEvents.trainingPreferencesEnd,
            },
            eligible: tUsersEvents.trainingEligible.valueWhenNull(
                tRoles.roleTrainingEligible).equals(/* true= */ 1),
            informationPublished: tEvents.trainingInformationPublished.equals(/* true= */ 1),
            training: {
                assignedDate: trainingsAssignedJoin.trainingStart,
                confirmed: trainingsAssignmentsJoin.assignmentConfirmed.equals(/* true= */ 1),
                preferenceDate: trainingsPreferenceJoin.trainingStart,
                updated: preferencesTrainingJoin.preferenceVersion,
            },
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!data)
        return undefined;

    const { availabilityWindow, training } = data;
    const hasTraining = !!training && (training.confirmed || !!training.updated);

    if (!data.eligible && !hasTraining)
        return undefined;

    const override = context.access.can('event.trainings', { event: event.slug });

    let enabled = data.informationPublished;

    let status: StatusButtonProps['status'] = 'pending';
    let primary: string | undefined;
    let secondary: string | undefined;

    if (hasTraining) {
        // (1) The volunteer has a confirmed spot in one of the sessions.
        if (!!training.assignedDate && training.confirmed) {
            const assignedDateTime = training.assignedDate.withTimeZone(event.timeZone);

            const assignedDate = formatDate(assignedDateTime, 'dddd, MMMM D');
            const assignedTime = formatDate(assignedDateTime, 'H:mm');

            status = 'confirmed';
            primary = `You'll join the training on ${assignedDate}`;
            secondary = `It starts at ${assignedTime}, please make sure to be there on time`;
        }

        // (2) The volunteer indicated their preferences and is confirmed to not to participate.
        else if (!training.assignedDate && training.confirmed) {
            status = 'confirmed';
            primary = 'You\'ll skip the professional training this year';
        }

        // (3) The volunteer indicated their preferences, wants to join and waits for confirmation.
        else if (!!training.preferenceDate) {
            const preferenceDate = formatDate(
                training.preferenceDate.withTimeZone(event.timeZone), 'dddd, MMMM D');

            status = 'submitted';
            primary = `You'd like to join the training on ${preferenceDate}`;
            secondary = 'This will be confirmed by a senior closer to the festival…';
        }

        // (4) The volunteer indicated their preferences and does not want to participate.
        else {
            status = 'submitted';
            primary = 'You would like to skip the training this year';
            secondary = 'This will be confirmed by a senior closer to the festival…';
        }
    } else {
        const availabilityWindowStatus = determineAvailabilityWindowStatus(availabilityWindow);

        // (5) The volunteer is able to indicate their preferences, but has not done so yet.
        primary = 'Do you want to join our professional training?';

        // (6) The information regarding training sessions has not been published yet.
        if (!enabled) {
            secondary = 'Training information has not been published yet…';

        // (7) The availability window for training preferences has not opened yet.
        } else if (!!availabilityWindowStatus) {
            enabled = availabilityWindowStatus.enabled;
            secondary = availabilityWindowStatus.secondary;
            status = availabilityWindowStatus.status;
        }
    }

    return (
        <StatusButton disabled={!enabled && !override} href={`${props.baseUrl}/training`}
                      overrideWarning={
                          (!enabled && override)
                              ? 'Access is limited to training managers'
                              : undefined
                      }
                      primary={primary} secondary={secondary} status={status} />
    );
}

/**
 * Props accepted by the <EventApplicationPage> page.
 */
export interface EventApplicationPageProps {
    /**
     * Context about the environment for which this page is being displayed.
     */
    context: EnvironmentContext;

    /**
     * Information about the event for which this page is being displayed.
     */
    event: EnvironmentContextEventAccess;

    /**
     * Information about the user's existing registration.
     */
    registration: {
        status: RegistrationStatus;
        team: {
            id: number;
            slug: string;
            title: string;
        };
        whatsAppLink?: string;
    };

    /**
     * The user who is currently signed in. We require someone to be signed in when applying, as
     * it helps carry their participation information across multiple events.
     */
    user: User;
}

/**
 * The <EventApplicationPage> component confirms to a user that their application has been
 * retrieved by the team's leads and the status of its consideration.
 */
export function EventApplicationPage(props: EventApplicationPageProps) {
    const { context, event, registration, user } = props;
    const { team } = registration;

    let label: string;
    let explanation: string;

    switch (registration.status) {
        case kRegistrationStatus.Registered:
            label = 'received';
            explanation =
                'The leads are considering it and will confirm your participation as soon as ' +
                'possible.';
            break;

        case kRegistrationStatus.Accepted:
            label = 'accepted';
            explanation =
                'We\'ve confirmed your participation and are really excited to get to work ' +
                `with you during ${event.shortName}!`;
            break;

        case kRegistrationStatus.Cancelled:
        case kRegistrationStatus.Rejected:
            label = registration.status === 'Cancelled' ? 'cancelled' : 'declined';
            explanation =
                'We\'re sorry that you won\'t be participating in this team during ' +
                event.shortName + '.';
            break;
    }

    const enableSchedule = event.publishPortal === 'active' || event.publishPortal === 'override';
    const enableScheduleWithOverride =
        enableSchedule || context.access.can('volunteers.schedules', 'read', {
            event: event.slug,
            team: team.slug,
        });

    const baseUrl = `/registration/${event.slug}/application/${team.slug}`;
    const buttonProps: ApplicationStatusButtonProps = {
        baseUrl,
        context,
        event,
        teamId: team.id,
        teamSlug: team.slug,
        user,
    };

    const sp = ' ';  // thanks React
    return (
        <>
            <Box sx={{ p: 2 }}>
                <Typography variant="body1">
                    {user.nameOrFirstName}, your application has been {label}. {explanation} Please
                    e-mail{sp}
                    <MuiLink component={Link} href="mailto:crew@animecon.nl">
                        crew@animecon.nl
                    </MuiLink>
                    {sp}in case you have any questions.
                </Typography>
            </Box>
            { registration.status === 'Accepted' &&
                <>
                    <Typography variant="body1" sx={{ px: 2 }}>
                        The follow options are available regarding your registration:
                    </Typography>
                    <List>
                        <ListItemButton LinkComponent={Link} sx={{ pl: 4 }}
                                        href={`${baseUrl}/participation`}>
                            <ListItemIcon>
                                <TaskAltIcon color="success" />
                            </ListItemIcon>
                            <ListItemText primary="Your application has been accepted!" />
                        </ListItemButton>

                        <AvailabilityButton {...buttonProps} />
                        <HotelStatusButton {...buttonProps} />
                        <TrainingStatusButton {...buttonProps} />
                        <RefundStatusButton {...buttonProps} />

                        { !!registration.whatsAppLink &&
                            <ListItemButton LinkComponent={Link} sx={{ pl: 4 }}
                                            href={registration.whatsAppLink}>
                                <ListItemIcon>
                                    <WhatsAppIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary={`Join the ${team.title} WhatsApp group!`}
                                    secondary="You're duly invited to meet your fellow volunteers" />
                            </ListItemButton> }

                        <ListItemButton LinkComponent={Link} sx={{ pl: 4 }}
                                        disabled={!enableScheduleWithOverride}
                                        href={`/schedule/${event.slug}`}>

                            <ListItemIcon>
                                <EventNoteIcon />
                            </ListItemIcon>

                            { enableSchedule &&
                                <ListItemText
                                    primary={`${event.shortName} Volunteer Portal`}
                                    secondary="Check your schedule and the festival's program" /> }

                            { !enableSchedule &&
                                <ListItemText
                                    primary={`${event.shortName} Volunteer Portal`}
                                    secondary="The volunteer portal is not yet available" /> }

                            { (!enableSchedule && enableScheduleWithOverride) &&
                                    <Tooltip title="Access is limited to certain volunteers">
                                        <TooltipIconWrapper>
                                            <VisibilityOffIcon color="warning" sx={{ mr: 2 }} />
                                        </TooltipIconWrapper>
                                    </Tooltip> }

                        </ListItemButton>

                    </List>
                </> }
        </>
    );
}
