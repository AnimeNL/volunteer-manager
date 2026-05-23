// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Alert from '@mui/material/Alert';

/**
 * Props accepted by the <CommunicationConfirmationView> component.
 */
interface CommunicationConfirmationViewProps {
    /**
     * Message that confirms to the user that the action has been committed.
     */
    message: string;
}

/**
 * The <CommunicationConfirmationView> component
 */
export function CommunicationConfirmationView(props: CommunicationConfirmationViewProps) {
    return (
        <Alert severity="success">
            {props.message}
        </Alert>
    );
}
