// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EmailMessage } from './EmailMessage';
import type { User } from '@lib/auth/User';

/**
 * Options that can be provided when sending an e-mail.
 */
export interface SendMessageRequest {
    /**
     * The message that should be distributed. Includes the recipients.
     */
    message: EmailMessage;

    /**
     * Name of the sender. Will be completed with the e-mail address. ("John Doe")
     */
    sender: string;

    /**
     * When known, the communication ID this message should be associated with.
     */
    communicationId?: number;

    /**
     * Source user, on whose behalf the message will be sent.
     */
    sourceUser?: number | User;

    /**
     * Target user, to whom the e-mail message will be sent.
     */
    targetUser?: number | User;
}
