// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useState } from 'react';

import { default as MuiLink } from '@mui/material/Link';
import Badge from '@mui/material/Badge';
import EmailIcon from '@mui/icons-material/Email';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { CommunicationLanguage } from '@lib/database/Types';
import type { ServerActionResult } from '@lib/serverAction';
import { CommunicationDialog, CommunicationIconButton }
    from '@app/admin/components/CommunicationDialog';

/**
 * Context passed to the <HotelOccupantCell> component.
 */
interface HotelOccupantCellContext {
    /**
     * Unique slug of the event for which hotel assignments are being displayed.
     */
    event: string;

    /**
     * Which occupant slot of the hotel room is being rendered.
     */
    occupant: 'first' | 'second' | 'third';
}

/**
 * Props accepted by the <HotelOccupantCell> component.
 */
interface HotelOccupantCellProps {
    /**
     * Context identifying the event and occupant slot.
     */
    context?: HotelOccupantCellContext;

    /**
     * The hotel booking row model being rendered.
     */
    row: {
        firstName?: string | null;
        firstUserId?: number | null;
        firstTeam?: string | null;

        secondName?: string | null;
        secondUserId?: number | null;
        secondTeam?: string | null;

        thirdName?: string | null;
        thirdUserId?: number | null;
        thirdTeam?: string | null;
    };
}

/**
 * Cell component for displaying an occupant of a hotel room, linking to their volunteer profile
 * when they are a volunteer participating in the event.
 */
export function HotelOccupantCell(props: HotelOccupantCellProps) {
    const occupant = props.context?.occupant ?? 'first';

    const name = props.row[`${occupant}Name`];
    if (!name) {
        return (
            <Typography variant="inherit" color="textDisabled" component="span"
                        sx={{ fontStyle: 'italic' }}>
                ···
            </Typography>
        );
    }

    const userId = props.row[`${occupant}UserId`];
    const team = props.row[`${occupant}Team`];

    if (!props.context?.event || !userId || !team)
        return <>{name}</>;

    const href = `/admin/events/${props.context.event}/${team}/volunteers/${userId}`;
    return (
        <MuiLink component={Link} href={href}>
            {name}
        </MuiLink>
    );
}

/**
 * Cell that serves as the header enabling hotel confirmation communication to be initiated.
 */
export function HotelCommunicationHeaderCell() {
    return (
        <Tooltip title="Confirm their hotel booking?">
            <EmailIcon color="action" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Context passed to the <HotelCommunicationCell> component.
 */
export interface HotelCommunicationCellContext {
    /**
     * Server Action to be invoked when a hotel confirmation communication is due to be sent.
     */
    action: (
        bookingId: number, recipientId: number, teamId: number, subject?: string, message?: string)
        => Promise<ServerActionResult>;

    /**
     * Unique ID of the event for which hotel assignments are being managed.
     */
    eventId: number;
}

/**
 * Props accepted by the <HotelCommunicationCell> component.
 */
interface HotelCommunicationCellProps {
    /**
     * Context passed to the communication cell.
     */
    context?: HotelCommunicationCellContext;

    /**
     * Row model containing booking details and occupant identities.
     */
    row: {
        id: number;
        hotelId?: number | null;
        hotelDescription?: string | null;
        checkIn: string;
        checkOut: string;

        firstName?: string | null;
        firstUserId?: number | null;
        firstTeamId?: number | null;
        firstLanguage?: CommunicationLanguage | null;
        firstCommunication?: string | null;

        secondName?: string | null;
        secondUserId?: number | null;
        secondTeamId?: number | null;
        secondLanguage?: CommunicationLanguage | null;
        secondCommunication?: string | null;

        thirdName?: string | null;
        thirdUserId?: number | null;
        thirdTeamId?: number | null;
        thirdLanguage?: CommunicationLanguage | null;
        thirdCommunication?: string | null;
    };
}

/**
 * Information about an individual volunteer recipient in a hotel booking.
 */
interface HotelBookingRecipient {
    communication?: string;
    language?: CommunicationLanguage;
    name: string;
    teamId: number;
    userId: number;
}

/**
 * Cell that contains a communication button through which each volunteer in the booking can be sent
 * a hotel confirmation e-mail.
 */
export function HotelCommunicationCell(props: HotelCommunicationCellProps) {
    const { action, eventId } = props.context!;

    const [ menuAnchor, setMenuAnchor ] = useState<HTMLElement | null>(null);
    const [ selectedRecipient, setSelectedRecipient ] =
        useState<HotelBookingRecipient | undefined>();
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);
    const [ openCounter, setOpenCounter ] = useState<number>(0);

    const handleOpenMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchor(event.currentTarget);
    }, []);

    const handleCloseMenu = useCallback(() => {
        setMenuAnchor(null);
    }, []);

    const handleSelectRecipient = useCallback((recipient: HotelBookingRecipient) => {
        setMenuAnchor(null);
        setSelectedRecipient(recipient);
        setOpenCounter(n => n + 1);
        setDialogOpen(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
        setDialogOpen(false);
    }, []);

    const slots = [ 'first', 'second', 'third' ] as const;
    const recipients: HotelBookingRecipient[] = [];

    if (props.row.hotelId) {
        for (const slot of slots) {
            const name = props.row[`${slot}Name`];
            const userId = props.row[`${slot}UserId`];
            const teamId = props.row[`${slot}TeamId`];
            const language = props.row[`${slot}Language`];
            const communication = props.row[`${slot}Communication`];

            if (!name || !userId || !teamId)
                continue;

            recipients.push({
                communication: communication ?? undefined,
                language: language ?? undefined,
                name,
                teamId,
                userId,
            });
        }
    }

    if (recipients.length <= 1) {
        const recipient = recipients[0];
        return (
            <CommunicationIconButton
                title={`Confirm ${recipient?.name}'s hotel booking`}
                action={action.bind(
                    null, props.row.id, recipient?.userId ?? 0, recipient?.teamId ?? 0)}
                badge={recipient?.communication ? 'check' : 'none'}
                disabled={!recipient}
                disableSilent
                language={recipient?.language}
                promptId="hotel-confirmation"
                promptParams={{
                    bookingId: props.row.id,
                    eventId,
                    teamId: recipient?.teamId ?? 0,
                }}
                recipientId={recipient?.userId ?? 0}>

                Send <strong>{recipient?.name}</strong> a confirmation e-mail for their booking at{' '}
                <strong>{props.row.hotelDescription}</strong> ({props.row.checkIn} to{' '}
                {props.row.checkOut}).

            </CommunicationIconButton>
        );
    }

    const communicatedCount = recipients.filter(r => !!r.communication).length;
    const badge =
        communicatedCount === recipients.length
            ? 'check'
            : communicatedCount > 0 ? 'warning' : 'none';

    return (
        <>
            <Tooltip title="Send an e-mail…">
                <IconButton onClick={handleOpenMenu} size="small">
                    { badge === 'check' &&
                        <MarkEmailReadIcon color="primary" fontSize="small" /> }
                    { badge === 'none' &&
                        <EmailIcon color="primary" fontSize="small" /> }
                    { badge === 'warning' &&
                        <Badge color="warning" variant="dot">
                            <EmailIcon color="primary" fontSize="small" />
                        </Badge> }
                </IconButton>
            </Tooltip>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={handleCloseMenu}>
                { recipients.map(recipient =>
                    <MenuItem key={recipient.userId} dense
                              onClick={ () => handleSelectRecipient(recipient) }>
                        <ListItemIcon>
                            { recipient.communication
                                ? <MarkEmailReadIcon color="success" fontSize="small" />
                                : <EmailIcon color="primary" fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText primary={recipient.name} />
                    </MenuItem> )}
            </Menu>
            { (!!openCounter && !!selectedRecipient) &&
                <CommunicationDialog
                    key={`${selectedRecipient.userId}-${openCounter}`}
                    title={`Confirm ${selectedRecipient.name}'s hotel booking`}
                    action={action.bind(
                        null, props.row.id, selectedRecipient.userId, selectedRecipient.teamId)}
                    disableSilent
                    language={selectedRecipient.language}
                    onClose={handleCloseDialog}
                    open={dialogOpen}
                    promptId="hotel-confirmation"
                    promptParams={{
                        bookingId: props.row.id,
                        eventId,
                        teamId: selectedRecipient.teamId,
                    }}
                    recipientId={selectedRecipient.userId}>

                    Send <strong>{selectedRecipient.name}</strong> a confirmation e-mail for their
                    booking at <strong>{props.row.hotelDescription}</strong> ({props.row.checkIn}{' '}
                    to {props.row.checkOut}).

                </CommunicationDialog> }
        </>
    );
}
