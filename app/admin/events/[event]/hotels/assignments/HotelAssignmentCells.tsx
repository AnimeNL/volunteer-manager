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
import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import type { ServerActionResult } from '@lib/serverAction';
import { CommunicationDialog } from '@app/admin/components/CommunicationDialog';

/**
 * Occupant slots supported for a hotel room booking.
 */
const kOccupantSlots = [ 'first', 'second', 'third' ] as const;

/**
 * Type representing one of the occupant slots of a hotel room booking.
 */
type OccupantSlot = (typeof kOccupantSlots)[number];

/**
 * Row model fields describing the occupants of a hotel room booking.
 */
type HotelOccupantRow =
    & Partial<Record<`${OccupantSlot}Name`, string | null>>
    & Partial<Record<`${OccupantSlot}UserId`, number | null>>
    & Partial<Record<`${OccupantSlot}Team`, string | null>>
    & Partial<Record<`${OccupantSlot}TeamId`, number | null>>
    & Partial<Record<`${OccupantSlot}Language`, CommunicationLanguage | null>>
    & Partial<Record<`${OccupantSlot}Communication`, Record<string, string> | null>>;

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
    occupant: OccupantSlot;
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
    row: HotelOccupantRow;
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
        bookingId: number, recipientId: number, teamId: number, promptId: CommunicationPromptId,
        subject?: string, message?: string) => Promise<ServerActionResult>;

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
    row: HotelOccupantRow & {
        id: number;
        hotelId?: number | null;
    };
}

/**
 * Information about an individual volunteer recipient in a hotel booking.
 */
interface HotelBookingRecipient {
    communication: Record<string, string>;
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

    const handleCloseMenu = useCallback(() => setMenuAnchor(null), [ /* no deps */ ]);
    const handleCloseDialog = useCallback(() => setDialogOpen(false), [ /* no deps */ ]);

    const handleSelectRecipient = useCallback((recipient: HotelBookingRecipient) => {
        setMenuAnchor(null);
        setSelectedRecipient(recipient);
        setOpenCounter(n => n + 1);
        setDialogOpen(true);
    }, [ /* no deps */ ]);

    const recipients: HotelBookingRecipient[] = [];
    if (props.row.hotelId) {
        for (const slot of kOccupantSlots) {
            const name = props.row[`${slot}Name`];
            const userId = props.row[`${slot}UserId`];
            const teamId = props.row[`${slot}TeamId`];

            if (!name || !userId || !teamId)
                continue;

            recipients.push({
                communication: props.row[`${slot}Communication`] ?? {},
                language: props.row[`${slot}Language`] ?? undefined,
                name,
                teamId,
                userId,
            });
        }
    }

    if (!recipients.length) {
        return (
            <IconButton disabled size="small">
                <EmailIcon color="disabled" fontSize="small" />
            </IconButton>
        );
    }

    const handleActivate = (event: React.MouseEvent<HTMLElement>) => {
        if (recipients.length === 1)
            handleSelectRecipient(recipients[0]);
        else
            setMenuAnchor(event.currentTarget);
    };

    const communicatedCount =
        recipients.filter(r => !!r.communication['hotel-confirmation']).length;

    let icon = <EmailIcon color="primary" fontSize="small" />;
    if (communicatedCount === recipients.length) {
        icon = <MarkEmailReadIcon color="primary" fontSize="small" />;
    } else if (communicatedCount > 0) {
        icon = (
            <Badge color="warning" variant="dot">
                {icon}
            </Badge>
        );
    }

    const promptParams = {
        bookingId: props.row.id,
        eventId,
        teamId: selectedRecipient?.teamId ?? 0,
    };

    return (
        <>
            <Tooltip title="Send an e-mail…">
                <IconButton onClick={handleActivate} size="small">
                    {icon}
                </IconButton>
            </Tooltip>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={handleCloseMenu}>
                { recipients.map(recipient =>
                    <MenuItem key={recipient.userId} dense
                              onClick={ () => handleSelectRecipient(recipient) }>
                        <ListItemIcon>
                            { recipient.communication['hotel-confirmation']
                                ? <MarkEmailReadIcon color="success" fontSize="small" />
                                : <EmailIcon color="primary" fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText primary={recipient.name} />
                    </MenuItem> )}
            </Menu>
            { (!!openCounter && !!selectedRecipient) &&
                <CommunicationDialog
                    key={`${selectedRecipient.userId}-${openCounter}`}
                    title={`Update ${selectedRecipient.name} about their hotel booking?`}
                    action={action.bind(
                        null, props.row.id, selectedRecipient.userId, selectedRecipient.teamId)}
                    disableSilent
                    language={selectedRecipient.language}
                    onClose={handleCloseDialog}
                    open={dialogOpen}
                    prompts={[
                        {
                            promptId: 'hotel-confirmation',
                            promptParams,
                            title: 'Confirm hotel booking',
                            mostRecentCommunication:
                                selectedRecipient.communication['hotel-confirmation'],
                        },
                        {
                            promptId: 'hotel-payment-reminder',
                            promptParams,
                            title: 'Send payment reminder',
                            mostRecentCommunication:
                                selectedRecipient.communication['hotel-payment-reminder'],
                        },
                    ]}
                    recipientId={selectedRecipient.userId}>

                    Send <strong>{selectedRecipient.name}</strong> an e-mail regarding their
                    booking.

                </CommunicationDialog> }
        </>
    );
}
