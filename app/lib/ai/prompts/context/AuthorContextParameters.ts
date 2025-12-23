// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Parameters relaying context about the author of the message that's been generated.
 */
export type AuthorContextParameters = {
    author: {
        name: string;
        role: string;
        team: string;
    };
};

/**
 * Example parameters that convey information about the author of a message.
 */
export const kAuthorContextExampleParameters: AuthorContextParameters = {
    author: {
        name: 'Julian Beaumont',
        role: 'Senior Crew',
        team: 'Volunteering Crew',
    },
};
