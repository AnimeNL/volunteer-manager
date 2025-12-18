// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { AiExplorer } from './AiExplorer';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { readSettings, type Setting } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The prompt explorer page allows volunteers to test the results of a particular AI prompt. While
 * all settings can be changed here, none of them can be stored.
 */
export default async function AiPromptExplorer(
    props: PageProps<'/admin/system/ai/prompt/[prompt]'>)
{
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const { prompt } = await props.params;

    const intentionSetting: Setting = `gen-ai-intention-${prompt}` as Setting;
    const settings = await readSettings([
        'gen-ai-personality',
        'gen-ai-system-instruction',
        intentionSetting,
    ]);

    return (
        <>
            <Section title="Generative AI (Explorer)">
                <SectionIntroduction>
                    This page enables you to explore one of the prompts the AnimeCon Volunteer
                    Manager uses to generate text. Note that any changes you make on this page will
                    not be saved, and that fake context is generated to complete the prompts.
                </SectionIntroduction>
            </Section>
            <AiExplorer intention={settings[intentionSetting] as string}
                        personality={settings['gen-ai-personality'] || ''}
                        systemInstructions={settings['gen-ai-system-instruction'] || ''}
                        type={prompt} />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Generative AI (Explorer) | AnimeCon Volunteer Manager',
};
