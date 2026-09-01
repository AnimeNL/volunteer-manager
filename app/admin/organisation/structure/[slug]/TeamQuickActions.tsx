// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import Button from '@mui/material/Button';
import KeyIcon from '@mui/icons-material/Key';
import RemoveCircleOutlinedIcon from '@mui/icons-material/RemoveCircleOutlined';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <TeamQuickActions> component.
 */
interface TeamQuickActionsProps {
    /**
     * Name of the team, to contextualise confirmation prompts.
     */
    name: string;

    /**
     * Server action to invoke when the team should be disabled.
     */
    disableTeamFn?: ServerAction;

    /**
     * Server action to invoke when the team should be enabled.
     */
    enableTeamFn?: ServerAction;

    /**
     * Server action to invoke when the team's invite key should be reset.
     */
    resetKeyFn?: ServerAction;
}

/**
 * The <TeamQuickActions> component renders quick action buttons for managing a team's status and
 * security, such as resetting its invitation key or toggling its enabled state.
 */
export function TeamQuickActions(props: TeamQuickActionsProps) {
    const { disableTeamFn, enableTeamFn, name, resetKeyFn } = props;

    const [ disableDialogOpen, setDisableDialogOpen ] = useState<boolean>(false);
    const [ enableDialogOpen, setEnableDialogOpen ] = useState<boolean>(false);
    const [ resetKeyDialogOpen, setResetKeyDialogOpen ] = useState<boolean>(false);

    const handleDisableOpen = useCallback(() => setDisableDialogOpen(true), [ /* no deps */ ]);
    const handleDisableClose = useCallback(() => setDisableDialogOpen(false), [ /* no deps */ ]);

    const handleEnableOpen = useCallback(() => setEnableDialogOpen(true), [ /* no deps */ ]);
    const handleEnableClose = useCallback(() => setEnableDialogOpen(false), [ /* no deps */ ]);

    const handleResetKeyOpen = useCallback(() => setResetKeyDialogOpen(true), [ /* no deps */ ]);
    const handleResetKeyClose = useCallback(() => setResetKeyDialogOpen(false), [ /* no deps */ ]);

    return (
        <>
            { !!resetKeyFn &&
                <Button color="info" size="small" variant="outlined"
                        startIcon={ <KeyIcon /> } onClick={handleResetKeyOpen}>
                    Reset key…
                </Button> }
            { !!disableTeamFn &&
                <Button color="error" size="small" variant="outlined"
                        startIcon={ <RemoveCircleOutlinedIcon /> } onClick={handleDisableOpen}>
                    Disable this team…
                </Button> }
            { !!enableTeamFn &&
                <Button color="success" size="small" variant="outlined"
                        startIcon={ <AddCircleOutlinedIcon /> } onClick={handleEnableOpen}>
                    Enable this team…
                </Button> }

            { !!resetKeyFn &&
                <ResponsiveConfirmationDialog
                    open={resetKeyDialogOpen}
                    onClose={handleResetKeyClose}
                    action={resetKeyFn}
                    confirmColor="error"
                    confirmLabel="Reset"
                    title="Reset key…">
                    Are you sure you want to reset the <strong>{name}</strong> team's key?
                    This will invalidate all invite links, for past and future events alike.
                </ResponsiveConfirmationDialog> }

            { !!disableTeamFn &&
                <ResponsiveConfirmationDialog
                    open={disableDialogOpen}
                    onClose={handleDisableClose}
                    action={disableTeamFn}
                    confirmColor="error"
                    confirmLabel="Disable"
                    title="Disable this team…">
                    Are you sure you want to disable the <strong>{name}</strong> team? This will
                    stop the team from being considered for any future events, but won't
                    remove any data.
                </ResponsiveConfirmationDialog> }

            { !!enableTeamFn &&
                <ResponsiveConfirmationDialog
                    open={enableDialogOpen}
                    onClose={handleEnableClose}
                    action={enableTeamFn}
                    confirmColor="success"
                    confirmLabel="Enable"
                    title="Enable this team…">
                    Are you sure you want to enable the <strong>{name}</strong> team? This means
                    that they can be considered for future events again.
                </ResponsiveConfirmationDialog> }
        </>
    );
}
