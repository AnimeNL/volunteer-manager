// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import { SelectElement, TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Button from '@mui/material/Button';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';

import type { CommunicationLanguage } from '@lib/database/Types';
import type { ServerAction, ServerActionResult } from '@lib/serverAction';
import { CommunicationDialog } from '@app/admin/components/CommunicationDialog';
import { ResponsiveFormDialog } from '@app/admin/components/ResponsiveFormDialog';

/**
 * Options available in the hotel and training eligibility override select.
 */
const kEligibilityOptions = [
    { id: '', label: '(default)' },
    { id: 1, label: 'Yes, they are eligible' },
    { id: 0, label: 'No, they are not eligible' },
];

/**
 * Props accepted by the <VolunteerQuickActions> component.
 */
interface VolunteerQuickActionsProps {
    /**
     * Server action to invoke when wanting to cancel a volunteer's participation.
     */
    cancelFn?: ServerAction<{ message?: string; subject?: string }>;

    /**
     * Unique ID of the event for which the volunteer is participating.
     */
    eventId?: number;

    /**
     * Default values for the overrides management form.
     */
    manageOverrides?: {
        /**
         * The volunteer's non-default availability timeslot limit.
         */
        timeslotLimit?: number;

        /**
         * The volunteer's non-default hotel room eligibility.
         */
        hotelEligible?: number;

        /**
         * The volunteer's non-default training eligibility.
         */
        trainingEligible?: number;
    };

    /**
     * Server action to invoke when wanting to manage their overrides.
     */
    manageOverridesFn?: ServerAction;

    /**
     * Server action to invoke when wanting to reinstate a volunteer's participation.
     */
    reinstateFn?: ServerAction<{ message?: string; subject?: string }>;

    /**
     * Unique ID of the team in which the volunteer is participating.
     */
    teamId?: number;

    /**
     * Information about the volunteer for whom this quick action is being displayed.
     */
    volunteer: {
        /**
         * Unique ID of the volunteer.
         */
        id: number;

        /**
         * First name of the volunteer, to contextualise warning prompts.
         */
        firstName: string;

        /**
         * Language in which the communication should be written, when known.
         */
        language?: CommunicationLanguage;
    };
}

/**
 * Component that displays the quick actions that are available for this particular volunteer.
 */
export function VolunteerQuickActions(props: VolunteerQuickActionsProps) {
    const [ cancelDialogOpen, setCancelDialogOpen ] = useState(false);
    const [ reinstateDialogOpen, setReinstateDialogOpen ] = useState(false);
    const [ manageOverridesDialogOpen, setManageOverridesDialogOpen ] = useState(false);

    const handleCancelSubmit = useCallback(async (subject?: string, message?: string)
        : Promise<ServerActionResult> =>
    {
        if (!props.cancelFn)
            return { success: false, error: 'Unable to perform this action.' };

        return await props.cancelFn({
            subject,
            message,
        });
    }, [ props.cancelFn ]);

    const handleReinstateSubmit = useCallback(async (subject?: string, message?: string)
        : Promise<ServerActionResult> =>
    {
        if (!props.reinstateFn)
            return { success: false, error: 'Unable to perform this action.' };

        return await props.reinstateFn({
            subject,
            message,
        });
    }, [ props.reinstateFn ]);

    return (
        <>
            { !!props.manageOverridesFn &&
                <Button startIcon={ <LayersOutlinedIcon /> } size="small" variant="outlined"
                        color="warning" onClick={ () => setManageOverridesDialogOpen(true) }>
                    Manage overrides
                </Button> }

            { !!props.cancelFn &&
                <Button startIcon={ <PersonRemoveOutlinedIcon /> } size="small" variant="outlined"
                        color="error" onClick={ () => setCancelDialogOpen(true) }>
                    Cancel participation
                </Button> }

            { !!props.reinstateFn &&
                <Button startIcon={ <PersonAddAltOutlinedIcon /> } size="small" variant="outlined"
                        color="error" onClick={ () => setReinstateDialogOpen(true) }>
                    Reinstate participation
                </Button> }

            { !!props.manageOverridesFn &&
                <ResponsiveFormDialog
                    open={manageOverridesDialogOpen}
                    onClose={ () => setManageOverridesDialogOpen(false) }
                    action={props.manageOverridesFn} defaultValues={props.manageOverrides}
                    submitColor="success"
                    submitLabel="Update"
                    title="Manage participation overrides"
                    description={
                        <>
                            Volunteers receive certain abilities and privileges based on their team
                            and role, but you can customise this for {props.volunteer.firstName}.
                            Leave fields empty to use defaults.
                        </>
                    }>

                    <TextFieldElement name="timeslotLimit" label="Allowed # of events to attend"
                                      size="small" fullWidth type="number" />

                    <SelectElement name="hotelEligible" label="Eligible for a hotel room?"
                                   options={kEligibilityOptions} size="small" fullWidth />

                    <SelectElement name="trainingEligible" label="Eligible for training?"
                                   options={kEligibilityOptions} size="small" fullWidth />

                </ResponsiveFormDialog> }

            { (!!props.cancelFn && !!props.eventId && !!props.teamId) &&
                <CommunicationDialog
                    title={`Cancel ${props.volunteer.firstName}'s participation`}
                    open={cancelDialogOpen}
                    onClose={ () => setCancelDialogOpen(false) }
                    action={handleCancelSubmit}
                    recipientId={props.volunteer.id}
                    language={props.volunteer.language}
                    promptId="participation-cancelled"
                    promptParams={{
                        eventId: props.eventId,
                        teamId: props.teamId,
                    }}>
                    Send an e-mail to <strong>{props.volunteer.firstName}</strong> about their
                    participation having been cancelled.
                </CommunicationDialog> }

            { (!!props.reinstateFn && !!props.eventId && !!props.teamId) &&
                <CommunicationDialog
                    title={`Reinstate ${props.volunteer.firstName}'s participation`}
                    open={reinstateDialogOpen}
                    onClose={ () => setReinstateDialogOpen(false) }
                    action={handleReinstateSubmit}
                    recipientId={props.volunteer.id}
                    language={props.volunteer.language}
                    promptId="participation-reinstated"
                    promptParams={{
                        eventId: props.eventId,
                        teamId: props.teamId,
                    }}>
                    Send an e-mail to <strong>{props.volunteer.firstName}</strong> about their
                    participation having been reinstated.
                </CommunicationDialog> }
        </>
    );
}
