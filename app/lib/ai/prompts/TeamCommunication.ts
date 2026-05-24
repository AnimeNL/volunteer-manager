// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type AuthorContextParameters, kAuthorContextExampleParameters } from './context/AuthorContextParameters';
import { type EventContextParameters, kEventContextExampleParameters } from './context/EventContextParameters';
import { type RecipientContextParameters, kRecipientContextExampleParameters } from './context/RecipientContextParameters';
import { type TeamContextParameters, kTeamContextExampleParameters } from './context/TeamContextParameters';

/**
 * Parameters commonly expected to be available for team-based communication.
 */
export type TeamCommunicationParameters =
    AuthorContextParameters & EventContextParameters & RecipientContextParameters &
    TeamContextParameters;

/**
 * Example values for the common team communication parameters.
 */
export const kTeamCommunicationExampleParameters = {
    author: kAuthorContextExampleParameters,
    event: kEventContextExampleParameters,
    recipient: kRecipientContextExampleParameters,
    team: kTeamContextExampleParameters,
};
