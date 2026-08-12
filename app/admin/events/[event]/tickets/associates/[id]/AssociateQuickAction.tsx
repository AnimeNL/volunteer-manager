// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';

import type { EventTicketProvider } from '@lib/database/Types';
import type { ServerAction } from '@lib/serverAction';
import { AutocompleteElementWithDisabledOptions } from '@app/admin/components/AutocompleteElementWithDisabledOptions';
import { HiddenInput } from '@components/HiddenInput';
import { ResponsiveFormDialog } from '@app/admin/components/ResponsiveFormDialog';

/**
 * Props accepted by the <AssociateQuickAction> component.
 */
interface AssociateQuickActionProps {
    /**
     * Server Action through which the association can be created.
     */
    action: ServerAction<{ ticketProvider: EventTicketProvider, userId: number }>;

    /**
     * Name of the ticketing partner used for this event.
     */
    ticketProvider: EventTicketProvider;

    /**
     * Volunteers who participate in the event.
     */
    volunteers: {
        /**
         * Unique ID of the volunteer.
         */
        id: number;

        /**
         * Name of the volunteer.
         */
        label: string;

        /**
         * Whether the option should be disabled. Volunteers may only get a single ticket associated
         * with their account per event, i.e. ones who already have a ticket will be disabled.
         */
        disabled?: boolean;

    }[];
}

/**
 * The <AssociateQuickAction> component allows a ticket to be associated with a volunteer that is
 * participating in the current event, but does not have a ticket associated with them yet.
 */
export function AssociateQuickAction(props: AssociateQuickActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), []);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    return (
        <>
            <Button startIcon={ <PersonAddAltOutlinedIcon /> } size="small" variant="outlined"
                    color="inherit" onClick={handleDialogOpen}>
                Associate with volunteer
            </Button>
            <ResponsiveFormDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={props.action}
                defaultValues={{ ticketProvider: props.ticketProvider }}
                title="Who should get this ticket?"
                submitLabel="Associate"
                description={
                    <>
                        Associating the ticket with a volunteer will allow them to enter the
                        festival. Volunteers may only have a single ticket associated with them.
                    </>
                }>

                <HiddenInput name="ticketProvider" />
                <AutocompleteElementWithDisabledOptions
                    name="userId" label="Volunteer" options={props.volunteers} required
                    matchId autocompleteProps={{ fullWidth: true, size: 'small' }} />

            </ResponsiveFormDialog>
        </>
    );
}
