// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Parameters relaying context about the invite key necessary to apply to join a certain team.
 */
export type TeamInviteKeyContextParameters = {
    teamInviteKey?: string;
};

/**
 * Example parameters that convey the invitation key.
 */
export const kTeamInviteKeyContextExampleParameters: TeamInviteKeyContextParameters = {
    teamInviteKey: '06a31d3b60c77db5',
};
