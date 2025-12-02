// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Box from '@mui/material/Box';
import EventNoteIcon from '@mui/icons-material/EventNote';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
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

import type { EnvironmentContext } from '@lib/EnvironmentContext';
import type { EventAvailabilityStatus } from '@lib/database/Types';
import type { Registration } from './EventApplicationStatus';
import type { User } from '@lib/auth/User';
import { Temporal, formatDate, isBefore, isAfter } from '@lib/Temporal';

import { kEventAvailabilityStatus, kRegistrationStatus } from '@lib/database/Types';

type RegistrationData = Registration['registration'];
type RegistrationRefund = NonNullable<RegistrationData['refund']>;
type RegistrationTraining = NonNullable<RegistrationData['training']>;

type WindowStatus =
    undefined | { enabled: boolean; status: 'pending' | 'missed'; secondary: string };

/**
 * Determines the status of the given `availabilityWindow` in relation to the current time (`now`).
 * When the item is not available due to the availability window being closed, a message with as
 * many details as we can share will be shown instead.
 */
function determineAvailabilityWindowStatus(
    now: Temporal.Instant,
    availabilityWindow?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime })
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
 * Props accepted by the <AvailabilityButton> component.
 */
interface AvailabilityButtonProps {
    /**
     * Base URL for linking the button to an appropriate location.
     */
    baseUrl: string;

    /**
     * What the status of the availability page is.
     */
    status: EventAvailabilityStatus;

    /**
     * Whether the volunteer has the ability to override normal access restrictions.
     */
    override: boolean;
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
function AvailabilityButton(props: AvailabilityButtonProps) {
    const { status, override } = props;

    const enabled =
        status === kEventAvailabilityStatus.Available || status === kEventAvailabilityStatus.Locked;

    let buttonStatus: 'pending' | 'available' | 'locked';
    let primary: string | undefined = undefined;
    let secondary: string | undefined = undefined;

    if (status === kEventAvailabilityStatus.Locked) {
        // (1) The volunteer is able to see their preferences, but can't change them.
        primary = 'When will you be around during the festival?';
        secondary = 'Your preferences have been noted!';
        buttonStatus = 'locked';
    } else if (status === kEventAvailabilityStatus.Available) {
        // (2) The volunteer is able to indicate their preferences.
        primary = 'When will you be around during the festival?';
        secondary = 'Please share your preferences at your convenience!';
        buttonStatus = 'available';
    } else {
        // (3) The volunteer is not able to indicate their preferences yet.
        primary = 'When will you be around during the festival?';
        secondary = 'The program has not been published yet…';
        buttonStatus = 'pending';
    }

    return (
        <ListItemButton LinkComponent={Link} sx={{ pl: 4 }}
                        disabled={!enabled && !override}
                        href={`${props.baseUrl}/availability`}>

            <ListItemIcon>
                { buttonStatus === 'locked' && <TaskAltIcon color="success" /> }
                { buttonStatus === 'available' && <RadioButtonUncheckedIcon color="success" /> }
                { buttonStatus === 'pending' && <RadioButtonUncheckedIcon color="warning" /> }
            </ListItemIcon>

            <ListItemText primary={primary} secondary={secondary} />

            { (!enabled && override) &&
                <Tooltip title="Access is limited to event managers">
                    <VisibilityOffIcon color="warning" sx={{ mr: 2 }} />
                </Tooltip> }

        </ListItemButton>
    );
}

/**
 * Props accepted by the <HotelStatusButton> component.
 */
interface HotelStatusButtonProps {
    /**
     * Availability window during which volunteers can indicate their hotel preferences.
     */
    availabilityWindow?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };

    /**
     * Base URL for linking the button to an appropriate location.
     */
    baseUrl: string;

    /**
     * Bookings that were created on behalf of the volunteer.
     */
    bookings: Registration['hotelBookings'];

    /**
     * Whether the button should be enabled by default, i.e. has information been published?
     */
    enabled: boolean;

    /**
     * Whether the volunteer has the ability to override normal access restrictions.
     */
    override: boolean;

    /**
     * Preferences the volunteer indicated regarding their hotel room bookings.
     */
    preferences: RegistrationData['hotelPreferences'];

    /**
     * The current time against which the `availabilityWindow` should be compared.
     */
    now: Temporal.Instant;
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
function HotelStatusButton(props: HotelStatusButtonProps) {
    const { availabilityWindow, bookings, now, override, preferences } = props;

    let enabled = props.enabled;

    let status: 'pending' | 'submitted' | 'confirmed' | 'missed' = 'pending';
    let primary: string | undefined = undefined;
    let secondary: string | undefined = undefined;

    // (1) The volunteer has one or more confirmed hotel room bookings.
    if (bookings.length > 0) {
        enabled = true;
        status = 'confirmed';

        let hotel: string;
        if (bookings.length > 1) {
            hotel = ` ${bookings.length} different rooms`;
            primary = `You've got ${bookings.length} confirmed hotel room bookings`;
        } else {
            hotel = ` the ${bookings[0].hotel.name}`;
            primary = 'Your hotel room has been confirmed!';
        }

        let earliestCheckIn = Temporal.PlainDate.from('2099-12-31');
        let latestCheckOut = Temporal.PlainDate.from('1999-01-01');

        for (const booking of bookings) {
            const checkIn = Temporal.PlainDate.from(booking.checkIn);
            const checkOut = Temporal.PlainDate.from(booking.checkOut);

            if (isAfter(earliestCheckIn, checkIn))
                earliestCheckIn = checkIn;
            if (isBefore(latestCheckOut, checkOut))
                latestCheckOut = checkOut;
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
        const availabilityWindowStatus = determineAvailabilityWindowStatus(now, availabilityWindow);

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
        <ListItemButton LinkComponent={Link} sx={{ pl: 4 }}
                        disabled={!enabled && !override}
                        href={`${props.baseUrl}/hotel`}>

            <ListItemIcon>
                { status === 'confirmed' && <TaskAltIcon color="success" /> }
                { status === 'submitted' && <RadioButtonUncheckedIcon color="success" /> }
                { status === 'pending' && <RadioButtonUncheckedIcon color="warning" /> }
                { status === 'missed' && <RadioButtonUncheckedIcon color="error" /> }
            </ListItemIcon>

            <ListItemText primary={primary} secondary={secondary} />

            { (!enabled && override) &&
                <Tooltip title="Access is limited to hotel booking managers">
                    <VisibilityOffIcon color="warning" sx={{ mr: 2 }} />
                </Tooltip> }

        </ListItemButton>
    );
}

/**
 * Props accepted by the <RefundStatusButton> component.
 */
interface RefundStatusButtonProps {
    /**
     * Availability window during which volunteers can request their ticket refund.
     */
    availabilityWindow?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };

    /**
     * Base URL for linking the button to an appropriate location.
     */
    baseUrl: string;

    /**
     * Whether the button should be enabled by default, i.e. has information been published?
     */
    enabled: boolean;

    /**
     * The current time against which the `availabilityWindow` should be compared.
     */
    now: Temporal.Instant;

    /**
     * Whether the volunteer has the ability to override normal access restrictions.
     */
    override: boolean;

    /**
     * Information about the volunteer's refund request, if any.
     */
    refund?: RegistrationRefund;

    /**
     * Timezone in which the event will be taking place.
     */
    timezone: string;
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
 *   (3) The volunteer is able to request a refund because of an override.
 */
function RefundStatusButton(props: RefundStatusButtonProps) {
    const { availabilityWindow, now, override, refund, timezone } = props;

    let enabled = props.enabled;

    let status: 'pending' | 'confirmed' | 'missed' = 'confirmed';
    let primary: string | undefined = undefined;
    let secondary: string | undefined = undefined;

    if (!!refund) {
        // (1) The volunteer has been issued a refund.
        if (!!refund.confirmed) {
            const confirmationDate =
                formatDate(
                    Temporal.ZonedDateTime.from(refund.confirmed).withTimeZone(timezone),
                    'dddd, MMMM D');

            primary = 'Your ticket has been refunded!';
            secondary = `We issued your refund on ${confirmationDate}`;
        }

        // (2) The volunteer has requested a refund.
        else {
            primary = 'You have requested a ticket refund';
            secondary = 'We\'ve received your request and will confirm it soon';
        }
    } else {
        const availabilityWindowStatus = determineAvailabilityWindowStatus(now, availabilityWindow);

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
        <ListItemButton LinkComponent={Link} sx={{ pl: 4 }} href={`${props.baseUrl}/refund`}>
            <ListItemIcon>
                { status === 'confirmed' && <TaskAltIcon color="success" /> }
                { status === 'pending' && <RadioButtonUncheckedIcon color="warning" /> }
                { status === 'missed' && <RadioButtonUncheckedIcon color="error" /> }
            </ListItemIcon>
            <ListItemText primary={primary} secondary={secondary} />
            { (!enabled && override) &&
                <Tooltip title="Visibility is limited to refund managers">
                    <VisibilityOffIcon color="warning" sx={{ mr: 2 }} />
                </Tooltip> }
        </ListItemButton>
    );
}

/**
 * Props accepted by the <TrainingStatusButton> component.
 */
interface TrainingStatusButtonProps {
    /**
     * Availability window during which volunteers can indicate their training preferences.
     */
    availabilityWindow?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };

    /**
     * Base URL for linking the button to an appropriate location.
     */
    baseUrl: string;

    /**
     * Whether the button should be enabled by default, i.e. has information been published?
     */
    enabled: boolean;

    /**
     * The current time against which the `availabilityWindow` should be compared.
     */
    now: Temporal.Instant;

    /**
     * Whether the volunteer has the ability to override normal access restrictions.
     */
    override: boolean;

    /**
     * Timezone in which the event (& thus the training) will be taking place.
     */
    timezone: string;

    /**
     * Information about the volunteer's preferences regarding participating in the training.
     */
    training?: RegistrationTraining;
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
function TrainingStatusButton(props: TrainingStatusButtonProps) {
    const { availabilityWindow, now, override, timezone, training } = props;

    let enabled = props.enabled;

    let status: 'pending' | 'submitted' | 'confirmed' | 'missed' = 'pending';
    let primary: string | undefined = undefined;
    let secondary: string | undefined = undefined;

    if (!!training && (training.confirmed || training.updated)) {
        // (1) The volunteer has a confirmed spot in one of the sessions.
        if (!!training.assignedDate && training.confirmed) {
            const assignedDateTime =
                Temporal.ZonedDateTime.from(training.assignedDate).withTimeZone(timezone);

            const assignedDate = formatDate(assignedDateTime, 'dddd, MMMM D');
            const assignedTime = formatDate(assignedDateTime, 'H:mm');

            status = 'confirmed';
            primary = `You'll join the training on ${assignedDate}`;
            secondary = `It starts at ${assignedTime}, please make sure to be there on time`;
        }

        // (2) The volunteer indicated their preferences and is confirmed to not to participate.
        else if (!training.assignedDate && training.confirmed) {
            status = 'confirmed';
            primary = 'You\'ll skip the professional training this year'
        }

        // (3) The volunteer indicated their preferences, wants to join and waits for confirmation.
        else if (!!training.preferenceDate) {
            const preferenceDate =
                formatDate(
                    Temporal.ZonedDateTime.from(training.preferenceDate).withTimeZone(timezone),
                    'dddd, MMMM D');

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
        const availabilityWindowStatus = determineAvailabilityWindowStatus(now, availabilityWindow);

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
        <ListItemButton LinkComponent={Link} sx={{ pl: 4 }}
                        disabled={!enabled && !override}
                        href={`${props.baseUrl}/training`}>

            <ListItemIcon>
                { status === 'confirmed' && <TaskAltIcon color="success" /> }
                { status === 'submitted' && <RadioButtonUncheckedIcon color="success" /> }
                { status === 'pending' && <RadioButtonUncheckedIcon color="warning" /> }
                { status === 'missed' && <RadioButtonUncheckedIcon color="error" /> }
            </ListItemIcon>

            <ListItemText primary={primary} secondary={secondary} />

            { (!enabled && override) &&
                <Tooltip title="Access is limited to training managers">
                    <VisibilityOffIcon color="warning" sx={{ mr: 2 }} />
                </Tooltip> }

        </ListItemButton>
    );
}

/**
 * Props accepted by the <EventApplicationPage> page.
 */
export interface EventApplicationPageProps {
    /**
     * Availability windows that apply for this event, as configured by volunteering leadership.
     */
    availabilityWindows: {
        hotelPreferences?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };
        refundRequests?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };
        trainingPreferences?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };
    };

    /**
     * Context about the environment for which this page is being displayed.
     */
    context: EnvironmentContext;

    /**
     * Information that needs to be known about the event in order to render this page.
     */
    event: {
        enableSchedule: boolean;
        hotelEnabled: boolean;
        refundEnabled: boolean;
        shortName: string;
        slug: string;
        timezone: string;
        trainingEnabled: boolean;
        whatsAppLink?: string;
    };

    /**
     * Information about the user's existing registration.
     */
    registration: Registration;

    /**
     * URL-safe slug that represents the team for this application.
     */
    team: string;

    /**
     * Title of the team that the volunteer has joined.
     */
    teamTitle: string;

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
    const { availabilityWindows: aw, event, team, teamTitle, user } = props;

    const { access } = props.context;

    const eventAccessScope = { event: event.slug };
    const teamAccessScope = { event: event.slug, team: team };

    const canAccessAvailability = access.can('event.visible', teamAccessScope);
    const canAccessHotels = access.can('event.hotels', eventAccessScope);
    const canAccessRefunds = access.can('event.refunds', eventAccessScope);
    const canAccessSchedule = access.can('event.schedule.planning', 'read', teamAccessScope);
    const canAccessTrainings = access.can('event.trainings', eventAccessScope);

    const { hotelBookings, registration } = props.registration;

    // ---------------------------------------------------------------------------------------------

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

    // Display and enablement of hotel booking preferences.
    const displayHotel = registration.hotelEligible || !!registration.hotelPreferences ||
                         hotelBookings.length > 0;

    // Display and enablement of the ticket refund option.
    const displayRefundWithOverride =
        registration.refund || registration.refundInformationPublished || canAccessRefunds;

    // Display and enablement of training preferences.
    const displayTraining = registration.trainingEligible || !!registration.training;

    const enableSchedule = event.enableSchedule;
    const enableScheduleWithOverride = enableSchedule || canAccessSchedule;

    // Base URL for links to more detailed registration pages.
    const baseUrl = `/registration/${event.slug}/application/${team}`;

    // The current moment in time as an instant, at the time of the component being mounted.
    const now = Temporal.Now.instant();

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
                        <ListItem sx={{ pl: 4 }}>
                            <ListItemIcon>
                                <TaskAltIcon color="success" />
                            </ListItemIcon>
                            <ListItemText primary="Your application has been accepted!" />
                        </ListItem>

                        <AvailabilityButton status={registration.availabilityStatus}
                                            override={canAccessAvailability} baseUrl={baseUrl} />

                        { (event.hotelEnabled && displayHotel) &&
                            <HotelStatusButton availabilityWindow={aw.hotelPreferences}
                                               bookings={hotelBookings} now={now}
                                               enabled={registration.hotelInformationPublished}
                                               override={canAccessHotels}
                                               preferences={registration.hotelPreferences}
                                               baseUrl={baseUrl} /> }

                        { (event.trainingEnabled && displayTraining) &&
                            <TrainingStatusButton availabilityWindow={aw.trainingPreferences}
                                                  enabled={
                                                      registration.trainingInformationPublished}
                                                  override={canAccessTrainings} baseUrl={baseUrl}
                                                  timezone={event.timezone} now={now}
                                                  training={registration.training} /> }

                        { (event.refundEnabled && displayRefundWithOverride) &&
                            <RefundStatusButton availabilityWindow={aw.refundRequests} now={now}
                                                enabled={registration.refundInformationPublished}
                                                override={canAccessRefunds}
                                                refund={registration.refund}
                                                baseUrl={baseUrl} timezone={event.timezone} /> }

                        { !!event.whatsAppLink &&
                            <ListItemButton LinkComponent={Link} sx={{ pl: 4 }}
                                            href={event.whatsAppLink}>
                                <ListItemIcon>
                                    <WhatsAppIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary={`Join the ${teamTitle} WhatsApp group!`}
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
                                        <VisibilityOffIcon color="warning" sx={{ mr: 2 }} />
                                    </Tooltip> }

                        </ListItemButton>

                    </List>
                </> }
        </>
    );
}
