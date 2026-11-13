// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import Snackbar from '@mui/material/Snackbar';

import type { ServerAction } from '@lib/serverAction';

/**
 * Props accepted by the <ConnectionCheckButton> component.
 */
interface ConnectionCheckButtonProps {
    /**
     * Server Action through which the connection check can be executed.
     */
    action: ServerAction;

    /**
     * Whether the button should be disabled (e.g. when the server is not yet configured).
     */
    disabled?: boolean;

    /**
     * Protocol name to include in the button label and fallback error message.
     */
    protocol: 'IMAP' | 'SMTP';
}

/**
 * Button that verifies the SMTP or IMAP connection configuration of the e-mail account.
 */
export function ConnectionCheckButton(props: ConnectionCheckButtonProps) {
    const [ state, setState ] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [ errorMessage, setErrorMessage ] = useState<string | undefined>();

    const fallbackError = `The ${props.protocol} connection check failed.`;

    const handleCloseError = useCallback(() => setErrorMessage(undefined), [ /* no deps */ ]);
    const handleCheck = useCallback(async () => {
        setState('checking');
        setErrorMessage(undefined);

        try {
            const result = await props.action({ /* no arguments */ });
            if (result.success) {
                setState('success');
            } else {
                setState('error');
                setErrorMessage(result.error ?? fallbackError);
            }
        } catch (error: any) {
            setState('error');
            setErrorMessage(error?.message || fallbackError);
        }
    }, [ fallbackError, props.action ]);

    let icon = <SettingsEthernetIcon />;
    let label = `Check ${props.protocol} connection`;
    let color: 'primary' | 'success' | 'error' = 'primary';

    if (state === 'success') {
        icon = <CheckCircleOutlinedIcon />;
        label = `${props.protocol} connection verified`;
        color = 'success';
    } else if (state === 'error') {
        icon = <CancelOutlinedIcon />;
        label = `${props.protocol} connection failed`;
        color = 'error';
    }

    return (
        <>
            <Button startIcon={icon} color={color} size="small" variant="outlined"
                    disabled={props.disabled} loading={ state === 'checking' }
                    onClick={handleCheck}>
                {label}
            </Button>
            <Snackbar open={!!errorMessage} autoHideDuration={5000} onClose={handleCloseError}>
                <Alert severity="error" variant="filled" onClose={handleCloseError}>
                    {errorMessage}
                </Alert>
            </Snackbar>
        </>
    );
}
