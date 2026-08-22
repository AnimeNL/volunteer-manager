// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { TextareaAutosizeElement } from '@components/proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

import { Example } from './Example';
import { FormGrid } from '@app/admin/components/FormGrid';
import { HiddenInput } from '@components/HiddenInput';
import { PromptIcon } from '../../PromptIcon';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TokenOverviewAlert } from '../../TokenOverviewAlert';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executePromptWithExampleParameters } from '@lib/ai/Actions';
import { readSettings } from '@lib/Settings';
import { requireAuthentication } from '@lib/requireAuthentication';
import { updatePrompt } from '../../AiActions';

import * as prompts from '@lib/ai/prompts';

/**
 * This page displays configuration, and provides the ability to try out an individual prompt. The
 * given |id| must exist in the communication prompt configuration, otherwise we'll 404.
 */
export default async function CommunicationPromptAiPage(
    props: PageProps<'/admin/system/ai/communication/[id]'>)
{
    await requireAuthentication('system.internals.ai');

    const promptId = (await props.params).id;

    const promptInstances = Object.values(prompts).map(promptConstructor => new promptConstructor);
    const prompt = promptInstances.find(promptInstance => promptInstance.metadata.id === promptId);
    if (!prompt || 'hidden' in prompt.metadata)
        notFound();

    const settings = await readSettings([
        prompt.metadata.settings.prompt,
    ]);

    const defaultValues = {
        id: prompt.metadata.id,
        prompt: settings[prompt.metadata.settings.prompt],
    };

    return (
        <>
            <Section icon={ <PromptIcon id={prompt.metadata.id} /> }
                     title={prompt.metadata.label}
                     breadcrumbs={[
                        { label: 'System', href: '/admin/system' },
                        { label: 'AI', href: '/admin/system/ai' },
                        { label: 'Communication', href: '/admin/system/ai/communication' },
                        { label: prompt.metadata.label },
                     ]}>
                <SectionIntroduction>
                    {prompt.metadata.description}
                </SectionIntroduction>
            </Section>
            <Section tabs back="Back to prompts" noHeader>
                <FormGrid action={updatePrompt} defaultValues={defaultValues}>
                    <Grid size={{ xs: 12 }}>
                        <TokenOverviewAlert prompt={prompt} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <HiddenInput name="id" />
                        <TextareaAutosizeElement name="prompt" label="Prompt template" size="small"
                                                 fullWidth />
                    </Grid>
                </FormGrid>
            </Section>
            <Section noHeader>
                <Example action={executePromptWithExampleParameters} id={prompt.metadata.id} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id' }, 'Communication', 'AI', 'System');
