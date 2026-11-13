// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import SendIcon from '@mui/icons-material/Send';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import Snackbar from '@mui/material/Snackbar';

import type { ServerAction } from '@lib/serverAction';
import { ActionBar } from '@app/admin/components/ActionBar';

/**
 * Execution state of an individual diagnostic action button.
 */
type ActionState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Returns the icon, label, and colour for a protocol connection-check button.
 */
function getConnectionAppearance(protocol: 'IMAP' | 'SMTP', state: ActionState) {
    if (state === 'success') {
        return {
            color: 'success' as const,
            icon: <CheckCircleOutlinedIcon />,
            label: `${protocol} connection verified`,
        };
    }

    if (state === 'error') {
        return {
            color: 'error' as const,
            icon: <CancelOutlinedIcon />,
            label: `${protocol} connection failed`,
        };
    }

    return {
        color: 'primary' as const,
        icon: <SettingsEthernetIcon />,
        label: `Check ${protocol} connection`,
    };
}

/**
 * Props accepted by the <AccountQuickActions> component.
 */
interface AccountQuickActionsProps {
    /**
     * Bound Server Action to verify the incoming (IMAP) connection, when IMAP is configured.
     */
    checkImapFn?: ServerAction;

    /**
     * Bound Server Action to verify the outgoing (SMTP) connection, when SMTP is configured.
     */
    checkSmtpFn?: ServerAction;

    /**
     * Bound Server Action to send a test message, when SMTP is configured.
     */
    sendTestMessageFn?: ServerAction;
}

/**
 * Diagnostic quick actions for verifying SMTP/IMAP connectivity and sending a test e-mail.
 */
export function AccountQuickActions(props: AccountQuickActionsProps) {
    const { checkImapFn, checkSmtpFn, sendTestMessageFn } = props;

    const [ states, setStates ] = useState<Record<'imap' | 'smtp' | 'test', ActionState>>({
        imap: 'idle',
        smtp: 'idle',
        test: 'idle',
    });
    const [ errorMessage, setErrorMessage ] = useState<string | undefined>();

    const handleCloseError = useCallback(() => setErrorMessage(undefined), [ /* no deps */ ]);

    const runAction = useCallback(async (
        key: 'imap' | 'smtp' | 'test',
        action: ServerAction | undefined,
        fallbackError: string) =>
    {
        if (!action)
            return;

        setStates(prev => ({ ...prev, [key]: 'loading' }));
        setErrorMessage(undefined);

        try {
            const result = await action({ /* no arguments */ });
            if (result.success) {
                setStates(prev => ({ ...prev, [key]: 'success' }));
            } else {
                setStates(prev => ({ ...prev, [key]: 'error' }));
                setErrorMessage(result.error ?? fallbackError);
            }
        } catch (error: any) {
            setStates(prev => ({ ...prev, [key]: 'error' }));
            setErrorMessage(error?.message || fallbackError);
        }
    }, [ /* no deps */ ]);

    const smtp = getConnectionAppearance('SMTP', states.smtp);
    const imap = getConnectionAppearance('IMAP', states.imap);

    return (
        <>
            <ActionBar>
                <Button color={smtp.color} disabled={!checkSmtpFn}
                        loading={ states.smtp === 'loading' }
                        onClick={() => runAction(
                            'smtp', checkSmtpFn, 'The SMTP connection check failed.')}
                        size="small" startIcon={smtp.icon} variant="outlined">
                    {smtp.label}
                </Button>
                { !!checkImapFn &&
                    <Button color={imap.color} loading={ states.imap === 'loading' }
                            onClick={() => runAction(
                                'imap', checkImapFn, 'The IMAP connection check failed.')}
                            size="small" startIcon={imap.icon} variant="outlined">
                        {imap.label}
                    </Button> }
                <Button color={ states.test === 'error' ? 'error' : 'primary' }
                        disabled={ !sendTestMessageFn || states.test === 'success' }
                        loading={ states.test === 'loading' }
                        onClick={() => runAction(
                            'test', sendTestMessageFn, 'Unable to send the test message.')}
                        size="small"
                        startIcon={
                            states.test === 'success' ? <MarkEmailReadOutlinedIcon /> : <SendIcon />
                        }
                        variant="outlined">
                    { states.test === 'success' ? 'Test message sent' : 'Send test message' }
                </Button>
            </ActionBar>
            <Snackbar autoHideDuration={5000} onClose={handleCloseError} open={!!errorMessage}>
                <Alert onClose={handleCloseError} severity="error" variant="filled">
                    {errorMessage}
                </Alert>
            </Snackbar>
        </>
    );
}
