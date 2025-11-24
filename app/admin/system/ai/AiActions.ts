// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { NardoPersonalisedAdvicePrompt } from '@lib/ai/communication/prompts/NardoPersonalisedAdvice';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { createAiClient } from '@lib/integrations/genai';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { writeSetting, writeSettings } from '@lib/Settings';

import { kAiSupportedModelIdentifiers } from '@lib/integrations/genai/Models';
import { PromptValidator } from '@lib/ai/communication/PromptValidator';

/**
 * Zod type that describes information required in order to execute a model.
 */
const kExecuteModelData = z.object({
    model: z.enum([ 'image', 'text' ]),
    prompt: z.string().nonempty(),
    attachment: z.array(z.instanceof(File)).optional(),
});

/**
 * Server action to execute a selected AI model.
 */
export async function executeModel(formData: unknown) {
    'use server';

    return executeServerAction(formData, kExecuteModelData, async (data, props) => {
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
 * Zod type that describes information required in order to update the Del a Rie Advies settings.
 */
const kUpdateNardoData = z.object({
    personalisedAdvice: z.string().nonempty(),
});

/**
 * Server action to update the prompts and settings used for Del a Rie Advies functionality.
 */
export async function updateNardo(formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateNardoData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'system.internals.ai',
        });

        const prompt = new NardoPersonalisedAdvicePrompt(data.personalisedAdvice);
        const promptValidator = PromptValidator.forPrompt(prompt);

        const validation = await promptValidator.validate();
        if (!validation.ok)
            return { success: false, error: validation.errors.join('\n') };

        await writeSettings({
            'ai-nardo-personalised-advice': data.personalisedAdvice,
        });

        return { success: true };
    });
}

/**
 * Zod type that describes information required in order to update the system prompt.
 */
const kUpdateSystemPromptData = z.object({
    systemPrompt: z.string().nonempty(),
});

/**
 * Server action to update the system prompt used in generated communication.
 */
export async function updateSystemPrompt(formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateSystemPromptData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'system.internals.ai',
        });

        await writeSetting('ai-communication-system-prompt', data.systemPrompt);
        return { success: true };
    });
}
