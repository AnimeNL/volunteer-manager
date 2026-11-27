// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import Skeleton from '@mui/material/Skeleton';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import Typography from '@mui/material/Typography';

import { EmptyStateCard } from '../components/EmptyStateCard';
import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { createScheduleMetadataFn } from '../lib/generateScheduleMetadata';
import { formatDate } from '@lib/Temporal';
import { getVolunteerHotelBookings } from '../lib/data/hotelData';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Type describing a single confirmed hotel room booking.
 */
type HotelBooking = Awaited<ReturnType<typeof getVolunteerHotelBookings>>[number];

/**
 * Renders the interior details of a single confirmed hotel booking card.
 */
function HotelBookingDetails(props: { booking: HotelBooking }) {
    const { booking } = props;

    const sharingText =
        booking.sharingWith.length > 0
            ? booking.sharingWith.join(' & ')
            : 'Not sharing with anyone';

    const rows: { icon: React.ReactNode; primary: string; secondary: React.ReactNode }[] = [
        {
            icon: <LoginOutlinedIcon fontSize="small" />,
            primary: 'Check-in',
            secondary: formatDate(booking.checkIn, 'dddd, MMMM D'),
        },
        {
            icon: <LogoutOutlinedIcon fontSize="small" />,
            primary: 'Check-out',
            secondary: formatDate(booking.checkOut, 'dddd, MMMM D'),
        },
        {
            icon: <PeopleOutlinedIcon fontSize="small" />,
            primary: 'Sharing with',
            secondary: sharingText,
        },
    ];

    if (booking.reservation) {
        rows.push({
            icon: <TagOutlinedIcon fontSize="small" />,
            primary: 'Reservation number',
            secondary: (
                <Typography component="span" variant="body2" sx={{
                    fontFamily: 'monospace',
                    letterSpacing: 1,
                }}>
                    {booking.reservation}
                </Typography>
            ),
        });
    }

    return (
        <>
            <CardContent>
                <Typography variant="h6">
                    {booking.hotelName}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    {booking.roomName}
                </Typography>
            </CardContent>
            <Divider />
            <List dense disablePadding>
                { rows.map(({ icon, primary, secondary }) =>
                    <ListItem key={primary}>
                        <ListItemIcon>
                            {icon}
                        </ListItemIcon>
                        <ListItemText
                            primary={primary}
                            secondary={secondary} />
                    </ListItem> ) }
            </List>
        </>
    );
}

/**
 * Authenticates the request behind `<Suspense>` and renders the primary hotel booking (or empty
 * state) inside the static `<Card>`.
 */
async function PrimaryHotelBooking(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);
    const bookings = await getVolunteerHotelBookings(event, user.id);

    if (!bookings.length) {
        return (
            <EmptyStateCard
                description={
                    <>
                        No confirmed hotel booking has been assigned to your account for{' '}
                        {event.shortName} yet.
                    </>
                }
                noCard
                title="No hotel room assigned" />
        );
    }

    return <HotelBookingDetails booking={bookings[0]} />;
}

/**
 * Renders any additional confirmed hotel bookings beyond the first as separate `<Card>` elements.
 */
async function AdditionalHotelBookings(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);
    const bookings = await getVolunteerHotelBookings(event, user.id);

    if (bookings.length <= 1)
        return null;

    return (
        <>
            { bookings.slice(1).map((booking, index) =>
                <Card key={index}>
                    <HotelBookingDetails booking={booking} />
                </Card> ) }
        </>
    );
}

/**
 * Skeleton placeholder shown inside the static `<Card>` while hotel bookings are streaming.
 */
function HotelSkeleton() {
    const rows = [
        { primaryWidth: 64, secondaryWidth: 120 },
        { primaryWidth: 74, secondaryWidth: 125 },
        { primaryWidth: 86, secondaryWidth: 135 },
        { primaryWidth: 135, secondaryWidth: 105 },
    ];

    return (
        <>
            <CardContent>
                <Typography variant="h6">
                    <Skeleton variant="text" width={160} />
                </Typography>
                <Typography variant="body2">
                    <Skeleton variant="text" width={200} />
                </Typography>
            </CardContent>
            <Divider />
            <List dense disablePadding>
                { rows.map(({ primaryWidth, secondaryWidth }, index) =>
                    <ListItem key={index}>
                        <ListItemIcon>
                            <Skeleton variant="circular" width={20} height={20} />
                        </ListItemIcon>
                        <ListItemText
                            primary={ <Skeleton variant="text" width={primaryWidth} /> }
                            secondary={ <Skeleton variant="text" width={secondaryWidth} /> } />
                    </ListItem> ) }
            </List>
        </>
    );
}

/**
 * Hotel room page for the schedule portal, displaying confirmation cards for each confirmed hotel
 * booking assigned to the signed-in volunteer.
 */
export default function ScheduleHotelPage(props: PageProps<'/schedule2/[event]/hotel'>) {
    return (
        <Page
            header={
                <Header
                    description="Catching some sleep during the festival"
                    icon={ <HotelOutlinedIcon /> }
                    title="Your hotel room" />
            }>
            <Card>
                <SuspenseReveal fallback={ <HotelSkeleton /> }>
                    <PrimaryHotelBooking params={props.params} />
                </SuspenseReveal>
            </Card>
            <Suspense fallback={null}>
                <AdditionalHotelBookings params={props.params} />
            </Suspense>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn('Hotel room', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
