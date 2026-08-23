// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState } from 'react';

import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import Button from '@mui/material/Button';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';

import type { ServerAction } from '@lib/serverAction';

/**
 * Props accepted by the <VolunteerQuickActions> component.
 */
interface VolunteerQuickActionsProps {
    /**
     * First name of the volunteer, to contextualise warning prompts.
     */
    firstName: string;

    /**
     * Server action to invoke when wanting to cancel a volunteer's participation.
     */
    cancelFn?: ServerAction;

    /**
     * Server action to invoke when wanting to reinstate a volunteer's participation.
     */
    reinstateFn?: ServerAction;

    /**
     * Server action to invoke when wanting to change a volunteer's role.
     */
    changeRoleFn?: ServerAction;

    /**
     * Server action to invoke when wanting to change a volunteer's team.
     */
    changeTeamFn?: ServerAction;

    /**
     * Server action to invoke when wanting to manage their overrides.
     */
    manageOverridesFn?: ServerAction;
}

/**
 * Component that displays the quick actions that are available for this particular volunteer.
 */
export function VolunteerQuickActions(props: VolunteerQuickActionsProps) {
    const [ cancelDialogOpen, setCancelDialogOpen ] = useState(false);
    const [ reinstateDialogOpen, setReinstateDialogOpen ] = useState(false);
    const [ changeRoleDialogOpen, setChangeRoleDialogOpen ] = useState(false);
    const [ changeTeamDialogOpen, setChangeTeamDialogOpen ] = useState(false);
    const [ manageOverridesDialogOpen, setManageOverridesDialogOpen ] = useState(false);

    return (
        <>
            { !!props.changeRoleFn &&
                <Button startIcon={ <BadgeOutlinedIcon /> } size="small" variant="outlined"
                        color="inherit" onClick={ () => setChangeRoleDialogOpen(true) }>
                    Change role
                </Button> }

            { !!props.changeTeamFn &&
                <Button startIcon={ <PeopleAltOutlinedIcon /> } size="small" variant="outlined"
                        color="inherit" onClick={ () => setChangeTeamDialogOpen(true) }>
                    Change team
                </Button> }

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

        </>
    );
}
