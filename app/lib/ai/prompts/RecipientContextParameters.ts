// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Parameters relaying context about the recipient of the message that's been generated.
 */
export type RecipientContextParameters = {
    recipient: {
        name: string;
    };
};

/**
 * Example parameters that convey information about the intended recipient of a message.
 */
export const kRecipientContextExampleParameters: RecipientContextParameters = {
    recipient: {
        name: 'Amara Thompson',
    },
};
