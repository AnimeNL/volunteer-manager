// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TeamEventPromptContext, TeamEventPromptParams } from './TeamEventPrompt';
import { TeamEventPrompt } from './TeamEventPrompt';
import { formatDate } from '@lib/Temporal';

/**
 * Prompt that can be used to convey to a volunteer that we liked working with them in a past event
 * and would like to work with them again.
 */
export class RemindParticipationPrompt extends TeamEventPrompt {
    constructor(params: TeamEventPromptParams) {
        super('gen-ai-intention-remind-participation', params);
    }

    override composeSubject(context: TeamEventPromptContext, language: string): string {
        return `${context.event.name} ${context.team.name}`;
    }

    override composeMessage(context: TeamEventPromptContext): string[] {
        const message = super.composeMessage(context);

        message.push('Before anything else, say that you hope that they are doing well.');
        message.push(
            'Express, in a professional manner, that we appreciated working with them at the ' +
            'most recent previous event.');

        message.push('You are reaching out because we have started organising the next event.');
        message.push(
            'We noticed that their name is still missing from the list of volunteers for the ' +
            'upcoming event.');

        if (context.event.eventTimingPublished) {
            message.push(
                `The festival starts on ${formatDate(context.event.startTime, 'YYYY-MM-DD')}, ` +
                    `and ends on ${formatDate(context.event.endTime, 'YYYY-MM-DD')}.`);
        } else {
            message.push(
                'Dates during which the festival will be taking place have not been announced ' +
                'yet.');
        }

        if (context.event.location) {
            message.push(`The festival will take place in ${context.event.location}.`);
        }

        message.push('Ask if they would be interested in participating again.');
        message.push(`If so, they can sign up on https://${context.team.domain}/registration/`);

        return message;
    }
}
