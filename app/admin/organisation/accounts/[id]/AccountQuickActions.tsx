// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState } from 'react';

import { TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import AttributionIcon from '@mui/icons-material/Attribution';
import Button from '@mui/material/Button';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockResetIcon from '@mui/icons-material/LockReset';
import PauseIcon from '@mui/icons-material/Pause';
import PinIcon from '@mui/icons-material/Pin';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import UnpublishedIcon from '@mui/icons-material/Unpublished';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog }
    from '@app/admin/components/ResponsiveConfirmationDialog';
import { ResponsiveFormDialog } from '@app/admin/components/ResponsiveFormDialog';

/**
 * Props accepted by the <AccountQuickActions> component.
 */
interface AccountQuickActionsProps {
    /**
     * First name of the account holder, to contextualise warning prompts.
     */
    firstName: string;

    /**
     * Reason that the account has been suspended, if any.
     */
    restricted?: string;

    /**
     * Server action to invoke when the account should be activated.
     */
    activateAccountFn?: ServerAction;

    /**
     * Server action to invoke when the account should be deactivated.
     */
    deactivateAccountFn?: ServerAction;

    /**
     * Server action to invoke when the account should be suspended.
     */
    restrictFn?: ServerAction;

    /**
     * Server action to invoke when the account should be unsuspended.
     */
    unrestrictFn?: ServerAction;

    /**
     * Server action to invoke when the account's password should be reset.
     */
    resetPasswordFn?: ServerAction;

    /**
     * Server action to invoke when an access code should be created.
     */
    createAccessCodeFn?: ServerAction;

    /**
     * Server action to invoke when the account should be impersonated.
     */
    impersonateFn?: ServerAction;
}

/**
 * The <AccountQuickActions> component provides a number of quick actions to alter the state
 * of the account that's being viewed, for example to (de)activate it or change its password. The
 * user interface will be built based on the server actions passed to this component.
 */
export function AccountQuickActions(props: AccountQuickActionsProps) {
    const [ activateAccountDialogOpen, setActivateAccountDialogOpen ] = useState(false);
    const [ createAccessCodeDialogOpen, setCreateAccessCodeDialogOpen ] = useState(false);
    const [ deactivateAccountDialogOpen, setDeactivateAccountDialogOpen ] = useState(false);
    const [ impersonateDialogOpen, setImpersonateDialogOpen ] = useState(false);
    const [ resetPasswordDialogOpen, setResetPasswordDialogOpen ] = useState(false);
    const [ suspendDialogOpen, setSuspendDialogOpen ] = useState(false);
    const [ unsuspendDialogOpen, setUnsuspendDialogOpen ] = useState(false);

    return (
        <>
            { !!props.deactivateAccountFn &&
                <Button startIcon={ <UnpublishedIcon /> } size="small" variant="outlined"
                        color="error" onClick={ () =>
                            setDeactivateAccountDialogOpen(true) }>
                    Deactivate
                </Button> }

            { !!props.activateAccountFn &&
                <Button startIcon={ <CheckCircleIcon /> } size="small" variant="outlined"
                        color="success" onClick={ () =>
                            setActivateAccountDialogOpen(true) }>
                    Activate
                </Button> }

            { !!props.restrictFn &&
                <Button startIcon={ <PauseIcon /> } size="small" variant="outlined"
                        color="error" onClick={ () =>
                            setSuspendDialogOpen(true) }>
                    Restrict
                </Button> }

            { !!props.unrestrictFn &&
                <Button startIcon={ <PlayArrowIcon /> } size="small" variant="outlined"
                        color="success" onClick={ () =>
                            setUnsuspendDialogOpen(true) }>
                    Unrestrict
                </Button> }

            { !!props.resetPasswordFn &&
                <Button startIcon={ <LockResetIcon /> } size="small" variant="outlined"
                        color="inherit" onClick={ () =>
                            setResetPasswordDialogOpen(true) }>
                    Reset password
                </Button> }

            { !!props.createAccessCodeFn &&
                <Button startIcon={ <PinIcon /> } size="small" variant="outlined"
                        color="inherit" onClick={ () =>
                            setCreateAccessCodeDialogOpen(true) }>
                    Access code
                </Button> }

            { !!props.impersonateFn &&
                <Button startIcon={ <AttributionIcon /> } size="small" variant="outlined"
                        color="inherit" onClick={ () =>
                            setImpersonateDialogOpen(true) }>
                    Impersonate
                </Button> }

            { !!props.activateAccountFn &&
                <ResponsiveConfirmationDialog
                    open={activateAccountDialogOpen}
                    onClose={ () => setActivateAccountDialogOpen(false) }
                    action={props.activateAccountFn}
                    confirmColor="success"
                    confirmLabel="Activate"
                    title="Activate the account">
                    Activate <strong>{props.firstName}</strong>'s account on their behalf,
                    which may be useful in case they aren't receiving our e-mail messages.
                </ResponsiveConfirmationDialog> }

            { !!props.deactivateAccountFn &&
                <ResponsiveConfirmationDialog
                    open={deactivateAccountDialogOpen}
                    onClose={ () => setDeactivateAccountDialogOpen(false) }
                    action={props.deactivateAccountFn}
                    confirmColor="error"
                    confirmLabel="Deactivate"
                    title="Deactivate the account">
                    Deactivating the account owned by <strong>{props.firstName}</strong> will
                    sign them out, and stops them from being able to sign in again.
                </ResponsiveConfirmationDialog> }

            { !!props.createAccessCodeFn &&
                <ResponsiveConfirmationDialog
                    open={createAccessCodeDialogOpen}
                    onClose={ () => setCreateAccessCodeDialogOpen(false) }
                    action={props.createAccessCodeFn}
                    confirmColor="success"
                    confirmLabel="Request"
                    title="Request an access code">
                    Request an access code for <strong>{props.firstName}</strong> using which
                    they can sign in to their account once to reset their password.
                </ResponsiveConfirmationDialog> }

            { !!props.impersonateFn &&
                <ResponsiveConfirmationDialog
                    open={impersonateDialogOpen}
                    onClose={ () => setImpersonateDialogOpen(false) }
                    action={props.impersonateFn}
                    confirmColor="success"
                    confirmLabel="Impersonate"
                    title="Impersonate this account">
                    You can impersonate <strong>{props.firstName}</strong>, which means that
                    you will be signed in to their account. You will be back to your own
                    account after signing out.
                </ResponsiveConfirmationDialog> }

            { !!props.resetPasswordFn &&
                <ResponsiveConfirmationDialog
                    open={resetPasswordDialogOpen}
                    onClose={ () => setResetPasswordDialogOpen(false) }
                    action={props.resetPasswordFn}
                    confirmColor="success"
                    confirmLabel="Request"
                    title="Request a password reset">
                    Request a password reset link for <strong>{props.firstName}</strong>,
                    using which they can immediately reset their password. The link is
                    yours to share with them.
                </ResponsiveConfirmationDialog> }

            { !!props.restrictFn &&
                <ResponsiveFormDialog
                    open={suspendDialogOpen}
                    onClose={ () => setSuspendDialogOpen(false) }
                    action={props.restrictFn}
                    submitColor="error"
                    submitLabel="Restrict"
                    title="Restrict this account"
                    description={
                        <>
                            Restricting the account owned by <strong>{props.firstName}</strong>
                            will stop them from being approved as volunteers in any of our
                            teams. The reason will remain private.
                        </>
                    }>
                    <TextFieldElement name="reason" label="Reason" size="small" fullWidth
                                      required sx={{ mt: 2 }} />
                </ResponsiveFormDialog> }

            { !!props.unrestrictFn &&
                <ResponsiveFormDialog
                    open={unsuspendDialogOpen}
                    onClose={ () => setUnsuspendDialogOpen(false) }
                    action={props.unrestrictFn}
                    submitColor="success"
                    submitLabel="Unrestrict"
                    title="Unrestrict this account"
                    description={
                        <>
                            Removing the restriction from the account owned by
                            <strong> {props.firstName}</strong> will enable their applications
                            to be approved again by team leads.
                        </>
                    }>
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        <strong>Reason for the restriction</strong>: {props.restricted}
                    </Alert>
                </ResponsiveFormDialog> }
        </>
    );
}
