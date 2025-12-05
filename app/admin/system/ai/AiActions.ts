// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { PromptValidator } from '@lib/ai/PromptValidator';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { createAiClient } from '@lib/integrations/genai';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { writeSetting, writeSettings } from '@lib/Settings';

import { kAiSupportedModelIdentifiers } from '@lib/integrations/genai/Models';

import * as prompts from '@lib/ai/prompts';

/**
 * Zod type that describes information required in order to execute a model.
 */
const kExecuteModelPlaygroundData = z.object({
    model: z.enum([ 'image', 'text' ]),
    prompt: z.string().nonempty(),
    attachment: z.array(z.instanceof(File)).optional(),
});

/**
 * Server action to execute a selected AI model from the Model Playground.
 */
export async function executeModelPlayground(formData: unknown) {
    'use server';

    return executeServerAction(formData, kExecuteModelPlaygroundData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'system.internals.ai',
        });

        const client = await createAiClient();

        let generatedImage: string | undefined;
        let generatedText: string | undefined;

        switch (data.model) {
            case 'image': {
                const response = await client.generateImage({
                    aspectRatio: '4:3',
                    attachments: data.attachment?.map(entry => ({
                        bytes: entry.bytes(),
                        mimeType: entry.type,
                    })),
                    prompt: data.prompt,
                });

                if (!response.success)
                    return { success: false, error: response.error };

                generatedImage = response.data;
                break;
            }

            case 'text': {
                const response = await client.generateText({
                    prompt: data.prompt,
                });

                if (!response.success)
                    return { success: false, error: response.error };

                generatedText = response.text;
                break;
            }
        }

        return {
            success: true,
            generatedImage,
            generatedText,
        };
    });
}

/**
 * Zod type that describes information required in order to update example messages.
 */
const kUpdateExampleMessagesData = z.object({
    exampleMessages: z.array(z.string().nullish()),
});

/**
 * Server action to update the example messages that can be consumed by AI.
 */
export async function updateExampleMessages(formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateExampleMessagesData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'system.internals.ai',
        });

        const exampleMessages = data.exampleMessages.filter(message => {
            return typeof message === 'string' && message.length > 0;
        });

        await writeSetting('ai-example-messages', JSON.stringify(exampleMessages));

        return {
            success: true,
            refresh: true,  // resets the form fields
        };
    });
}

/**
 * Zod type that describes information required in ordr to upload model settings.
 */
const kUpdateModelSettingsData = z.object({
    imageModel: z.enum(kAiSupportedModelIdentifiers),
    textModel: z.enum(kAiSupportedModelIdentifiers),
    backend: z.enum([ 'gemini', 'vertexai' ]),
    geminiApiKey: z.string().nonempty(),

    candidateCount: z.number().min(0).max(8),
    temperature: z.number().min(0).max(2),
    topK: z.number().min(1).max(64),
    topP: z.number().min(0).max(1),
});

/**
 * Server action to update the model settings used by the system globally.
 */
export async function updateModelSettings(formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateModelSettingsData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'system.internals.ai',
        });

        await writeSettings({
            'ai-setting-backend': data.backend,
            'ai-setting-gemini-api-key': data.geminiApiKey,
            'ai-setting-image-model': data.imageModel,
            'ai-setting-text-model': data.textModel,
            'ai-setting-candidate-count': data.candidateCount,
            'ai-setting-temperature': data.temperature,
            'ai-setting-top-k': data.topK,
            'ai-setting-top-p': data.topP,
        });

        RecordLog({
            type: kLogType.AdminUpdateIntegration,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                integration: 'Generative AI',
            }
        });

        return { success: true };
    });
}

/**
 * Zod type that describes information required in order to update a particular prompt.
 */
const kUpdatePromptData = z.object({
    id: z.string().nonempty(),
    prompt: z.string().nonempty(),
});

/**
 * Server action to update the system prompt used in generated communication.
 */
export async function updatePrompt(formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdatePromptData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'system.internals.ai',
        });

        const relevantPromptConstructor = Object.values(prompts).find(promptConstructor => {
            const instance = new promptConstructor();
            return instance.metadata.id === data.id;
        });

        if (!relevantPromptConstructor)
            notFound();

        const prompt = new relevantPromptConstructor(data.prompt);
        const promptValidator = PromptValidator.forPrompt(prompt);

        const validation = await promptValidator.validate();
        if (!validation.ok)
            return { success: false, error: validation.errors.join('\n') };

        RecordLog({
            type: kLogType.AdminUpdateAiSetting,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                setting: `${prompt.metadata.label} prompt`,
            },
        });

        await writeSetting(prompt.metadata.setting, data.prompt);
        return { success: true };
    });
}
