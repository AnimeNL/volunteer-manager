// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Parameters relaying context about the team relating to the message that's been generated.
 */
export type TeamContextParameters = {
    team: {
        description: string;
        domain: string;
        slug: string;
        title: string;
    };
};

/**
 * Example parameters that convey information about the team relating to the generated message.
 */
export const kTeamContextExampleParameters: TeamContextParameters = {
    team: {
        description: 'Stewards are the first line of defense when trouble arises.',
        domain: 'stewards.team',
        slug: 'stewards',
        title: 'Steward Team',
    },
};
