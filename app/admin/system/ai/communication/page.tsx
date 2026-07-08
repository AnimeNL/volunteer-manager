// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from '@app/LinkProxy';

import { TextareaAutosizeElement } from '@components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';

import { FormGridSection } from '@app/admin/components/FormGridSection';
import { HiddenInput } from '@components/HiddenInput';
import { PersonalityDialogAction } from './PersonalityDialogAction';
import { PromptIcon } from '../PromptIcon';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SystemPrompt } from '@lib/ai/prompts/SystemPrompt';
import { TokenOverviewAlert } from '../TokenOverviewAlert';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import * as actions from '../AiActions';
import * as prompts from '@lib/ai/prompts';

/**
 * Maximum number of example messages that can be provided to the model.
 */
const kMaximumExampleMessages = 5;

/**
 * The communication page contains the settings and prompts used for generated messages coming from
 * the Volunteer Manager. Each individual setting has its own sub page.
 */
export default async function CommunicationAiPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const settings = await readSettings([
        'ai-communication-personality-prompt',
        'ai-communication-system-prompt',
        'ai-duty-book-summary-prompt',
        'ai-example-messages',
        'ai-incident-summary-prompt',
    ]);

    const exampleMessages = settings['ai-example-messages'] || [ /* no example messages */ ];

    const systemPromptTemplate = settings['ai-communication-system-prompt'] || '';
    const systemPrompt = new SystemPrompt();

    // Infer the available prompts from the ones exported from the //lib/ai/ library,
    // which is the source of truth. Icons are complemented by this component.
    const availablePrompts = Object.values(prompts).map(promptConstructor => {
        const promptInstance = new promptConstructor();
        return {
            metadata: promptInstance.metadata,
        };
    }).filter(({ metadata }) => { return metadata.type === 'Communication'
    }).sort((lhs, rhs) => lhs.metadata.label.localeCompare(rhs.metadata.label));

    // Action to enable visualising the default personality prompt, which in itself is AI generated.
    let defaultPersonalityAction: React.ReactNode;
    if (!!settings['ai-communication-personality-prompt']) {
        defaultPersonalityAction = (
            <PersonalityDialogAction
                personality={settings['ai-communication-personality-prompt']} />
        );
    }

    return (
        <>
            <Section icon={ <QuestionAnswerOutlinedIcon color="primary" /> } title="Communication"
                     breadcrumbs={[
                        { label: 'System', href: '/admin/system' },
                        { label: 'AI', href: '/admin/system/ai' },
                        { label: 'Communication' },
                     ]}>
                <SectionIntroduction>
                    AI is used to generate the first draft of all outgoing communication. Humans
                    will retain full editorial control. For now.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <List disablePadding dense>
                    { availablePrompts.map(({ metadata }) =>
                        <ListItemButton key={metadata.id} LinkComponent={Link}
                                        href={`./communication/${metadata.id}`}>
                            <ListItemIcon sx={{ width: 40 }}>
                                <PromptIcon id={metadata.id} />
                            </ListItemIcon>
                            <ListItemText primary={metadata.label}
                                          secondary={metadata.description} />
                        </ListItemButton> )}
                </List>
            </Section>
            <FormGridSection action={actions.updatePrompt}
                             defaultValues={{ id: 'system-prompt', prompt: systemPromptTemplate }}
                             title="System prompt">
                <Grid size={{ xs: 12 }}>
                    <TokenOverviewAlert prompt={systemPrompt} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <HiddenInput name="id" />
                    <TextareaAutosizeElement name="prompt" label="System prompt" fullWidth
                                             size="small" />
                </Grid>
            </FormGridSection>
            <FormGridSection action={actions.updateExampleMessages}
                             defaultValues={{ exampleMessages }}
                             title="Example messages">
                <Grid size={{ xs: 12 }}>
                    <Alert severity="warning" action={defaultPersonalityAction}>
                        These messages will be superseded by those provided in account settings. No
                        tokens are available.
                    </Alert>
                </Grid>
                { Array(kMaximumExampleMessages).fill(null).map((_, index) =>
                    <Grid key={index} size={{ xs: 12 }}>
                        <TextareaAutosizeElement key={index} name={`exampleMessages[${index}]`}
                                                 label={`Example message ${index + 1}`}
                                                 fullWidth size="small" />
                    </Grid> )}
            </FormGridSection>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Communication | Artificial Intelligence | AnimeCon Volunteer Manager',
};
