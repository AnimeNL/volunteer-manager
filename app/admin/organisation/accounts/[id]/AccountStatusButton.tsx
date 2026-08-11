// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import DangerousOutlinedIcon from '@mui/icons-material/DangerousOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import Stack from '@mui/material/Stack';

import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Props accepted by the <AccountStatusButton> component.
 */
interface AccountStatusButtonProps {
    /**
     * Whether the account has been activated.
     */
    activated: boolean;

    /**
     * Reason that the account has been restricted, if any.
     */
    restricted?: string;
}

/**
 * The <AccountStatusButton> component displays a button, to be used in the account header, that
 * indicates the status of this account: both restricted and unactivated accounts will be labelled.
 */
export function AccountStatusButton(props: AccountStatusButtonProps) {
    const [ activationDialogOpen, setActivationDialogOpen ] = useState(false);
    const [ restrictedDialogOpen, setRestrictedDialogOpen ] = useState(false);

    const handleActivationDialogClose = useCallback(() => setActivationDialogOpen(false), [ ]);
    const handleActivationDialogOpen = useCallback(() => setActivationDialogOpen(true), [ ]);

    const handleRestrictedDialogClose = useCallback(() => setRestrictedDialogOpen(false), [ ]);
    const handleRestrictedDialogOpen = useCallback(() => setRestrictedDialogOpen(true), [ ]);

    return (
        <>
            <Stack direction="row" spacing={1.5}>
                { !props.activated &&
                    <Button startIcon={ <PauseIcon />} size="small" variant="outlined"
                            color="warning" onClick={handleActivationDialogOpen}>
                        Unactivated
                    </Button> }
                { !!props.restricted &&
                    <Button startIcon={ <DangerousOutlinedIcon /> } size="small" variant="outlined"
                            color="error" onClick={handleRestrictedDialogOpen}>
                        Restricted
                    </Button> }
            </Stack>
            { !props.activated &&
                <ResponsiveDialog open={activationDialogOpen}
                                  onClose={handleActivationDialogClose}
                                  title="Account has not been activated"
                                  description={
                                      <>
                                          This account is pending activation, a link for which has
                                          been sent to their e-mail address. They're unable to sign
                                          in until activation has completed.
                                      </>
                                  } /> }
            { !!props.restricted &&
                <ResponsiveDialog open={restrictedDialogOpen}
                                  onClose={handleRestrictedDialogClose}
                                  title="Account has been restricted"
                                  description={
                                      <>
                                          This account has been restricted from participating in
                                          future events for the following reason; their applications
                                          can't be accepted until the restriction is lifted.
                                      </>
                                  }>

                    <Alert severity="warning" variant="outlined">
                        {props.restricted}
                    </Alert>

                </ResponsiveDialog> }
        </>
    );
}
