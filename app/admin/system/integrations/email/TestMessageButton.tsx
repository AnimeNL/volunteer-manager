// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import SendIcon from '@mui/icons-material/Send';

import type { ServerAction } from '@lib/serverAction';

/**
 * Props accepted by the <TestMessageButton> component.
 */
interface TestMessageButtonProps {
    /**
     * Server Action through which the test message can be send.
     */
    action: ServerAction;
}

/**
 * Component that allows a test message to be send from one of the test accounts to the e-mail
 * address of the signed in user.
 */
export function TestMessageButton(props: TestMessageButtonProps) {
    const [ state, setState ] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    const handleSendMessage = useCallback(async () => {
        setState('sending');
        try {
            const result = await props.action({ /* no arguments */ });
            setState(result.success ? 'sent' : 'error');
        } catch (error: any) {
            console.warn('Exception while sending a message:', error);
            setState('error');
        }
    }, [ props.action ]);

    return (
        <Button startIcon={ state === 'sent' ? <MarkEmailReadOutlinedIcon /> : <SendIcon /> }
                color={ state === 'error' ? 'error' : 'primary' }
                size="small" variant="contained" loading={ state === 'sending' }
                disabled={ state === 'sent' } onClick={handleSendMessage}>
            { state !== 'sent' && 'Send' }
            { state === 'sent' && 'Sent' }
        </Button>
    );
}
