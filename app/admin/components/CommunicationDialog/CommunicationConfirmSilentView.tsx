// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

/**
 * The <CommunicationConfirmSilentView> component displays a confirmation warning that explains to
 * the user that they are now responsible for informing the recipient of whatever action they're
 * about to commit.
 */
export function CommunicationConfirmSilentView() {
    return (
        <Alert severity="warning">
            <AlertTitle>
                Flying under the radar here…
            </AlertTitle>
            You're about to make this change without sending them an e-mail. Please remember to
            reach out and let them know directly!
        </Alert>
    );
}
