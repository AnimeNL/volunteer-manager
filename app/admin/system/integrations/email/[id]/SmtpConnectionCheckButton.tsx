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
 * Props accepted by the <SmtpConnectionCheckButton> component.
 */
interface SmtpConnectionCheckButtonProps {
    /**
     * Server Action through which the SMTP connection check can be executed.
     */
    action: ServerAction;

    /**
     * Whether the button should be disabled (e.g. when SMTP is not yet configured).
     */
    disabled?: boolean;
}

/**
 * Button that verifies the SMTP connection configuration of the e-mail account.
 */
export function SmtpConnectionCheckButton(props: SmtpConnectionCheckButtonProps) {
    const [ state, setState ] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [ errorMessage, setErrorMessage ] = useState<string | undefined>();

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
                setErrorMessage(result.error ?? 'The SMTP connection check failed.');
            }
        } catch (error: any) {
            setState('error');
            setErrorMessage(error?.message || 'The SMTP connection check failed.');
        }
    }, [ props.action ]);

    let icon = <SettingsEthernetIcon />;
    let label = 'Check SMTP connection';
    let color: 'primary' | 'success' | 'error' = 'primary';

    if (state === 'success') {
        icon = <CheckCircleOutlinedIcon />;
        label = 'SMTP connection verified';
        color = 'success';
    } else if (state === 'error') {
        icon = <CancelOutlinedIcon />;
        label = 'SMTP connection failed';
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
