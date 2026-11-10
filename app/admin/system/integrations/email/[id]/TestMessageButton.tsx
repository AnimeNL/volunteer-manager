// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import SendIcon from '@mui/icons-material/Send';
import Snackbar from '@mui/material/Snackbar';

import type { ServerAction } from '@lib/serverAction';

/**
 * Props accepted by the <TestMessageButton> component.
 */
interface TestMessageButtonProps {
    /**
     * Server Action through which the test message can be sent.
     */
    action: ServerAction;

    /**
     * Whether the button should be disabled (e.g. when SMTP is not yet configured).
     */
    disabled?: boolean;
}

/**
 * Button that sends a test e-mail message from this account to the signed-in user.
 */
export function TestMessageButton(props: TestMessageButtonProps) {
    const [ state, setState ] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [ errorMessage, setErrorMessage ] = useState<string | undefined>();

    const handleCloseError = useCallback(() => setErrorMessage(undefined), [ /* no deps */ ]);
    const handleSendMessage = useCallback(async () => {
        setState('sending');
        setErrorMessage(undefined);

        try {
            const result = await props.action({ /* no arguments */ });
            if (result.success) {
                setState('sent');
            } else {
                setState('error');
                setErrorMessage(result.error ?? 'Unable to send the test message.');
            }
        } catch (error: any) {
            setState('error');
            setErrorMessage(error?.message || 'Unable to send the test message.');
        }
    }, [ props.action ]);

    return (
        <>
            <Button startIcon={ state === 'sent' ? <MarkEmailReadOutlinedIcon /> : <SendIcon /> }
                    color={ state === 'error' ? 'error' : 'primary' }
                    size="small" variant="outlined" loading={ state === 'sending' }
                    disabled={ props.disabled || state === 'sent' } onClick={handleSendMessage}>
                { state === 'sent' ? 'Test message sent' : 'Send test message' }
            </Button>
            <Snackbar open={!!errorMessage} autoHideDuration={5000} onClose={handleCloseError}>
                <Alert severity="error" variant="filled" onClose={handleCloseError}>
                    {errorMessage}
                </Alert>
            </Snackbar>
        </>
    );
}
