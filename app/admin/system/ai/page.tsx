// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { AiPromptContext, type AiPromptContextProps } from './AiPromptContext';
import { AiPromptPersonality } from './AiPromptPersonality';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The AI page contains the prompt configuration used for our use of Generative AI throughout the
 * volunteer portal. The page is protected behind a special permission.
 */
export default async function AiPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    // Settings to load for this page, shared across the different displays.
    const settings = await readSettings([
        // <AiPromptPersonality>:
        'gen-ai-personality',
        'gen-ai-system-instruction',

        // <AiPromptContext>:
        'gen-ai-intention-approve-volunteer',
        'gen-ai-intention-cancel-participation',
        'gen-ai-intention-change-team',
        'gen-ai-intention-reinstate-participation',
        'gen-ai-intention-reject-volunteer',
        'gen-ai-intention-remind-participation',
    ]);

    // <AiPromptContext> intentions:
    const intentions: AiPromptContextProps['intentions'] = [
        {
            label: 'Application (approve)',
            intention: settings['gen-ai-intention-approve-volunteer'] ?? '',
            setting: 'gen-ai-intention-approve-volunteer',
        },
        {
            label: 'Application (reject)',
            intention: settings['gen-ai-intention-reject-volunteer'] ?? '',
            setting: 'gen-ai-intention-reject-volunteer',
        },
        {
            label: ' Participation (change team)',
            intention: settings['gen-ai-intention-change-team'] ?? '',
            setting: 'gen-ai-intention-change-team',
        },
        {
            label: 'Participation (cancel)',
            intention: settings['gen-ai-intention-cancel-participation'] ?? '',
            setting: 'gen-ai-intention-cancel-participation',
        },
        {
            label: 'Participation (reinstate)',
            intention: settings['gen-ai-intention-reinstate-participation'] ?? '',
            setting: 'gen-ai-intention-reinstate-participation',
        },
        {
            label: 'Participation (reminder)',
            intention: settings['gen-ai-intention-remind-participation'] ?? '',
            setting: 'gen-ai-intention-remind-participation',
        },
    ];

    return (
        <>
            <Section title="Generative AI">
                <SectionIntroduction>
                    While the AnimeCon Volunteer Manager uses generative AI to draft messages to
                    volunteers, leads will always have the ability to overwrite them. Personality is
                    shared across the individual prompts, which are specific to context that will be
                    added programmatically.
                </SectionIntroduction>
            </Section>
            <AiPromptPersonality personality={settings['gen-ai-personality'] ?? ''}
                                 systemInstruction={settings['gen-ai-system-instruction'] ?? ''} />
            <AiPromptContext intentions={intentions} />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Artificial Intelligence | AnimeCon Volunteer Manager',
};
