// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { PromptExecutor } from '@lib/ai/PromptExecutor';
import { PromptFactory } from '@lib/ai/PromptFactory';
import { PromptValidator } from '@lib/ai/PromptValidator';
import { createAiClient } from '@lib/integrations/genai';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthentication } from '@lib/requireAuthentication';
import { writeExampleMessages } from '@lib/ai/ExampleMessages';
import { writeSetting, writeSettings } from '@lib/Settings';

import { kAiSupportedModelIdentifiers } from '@lib/integrations/genai/Models';

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
        await requireAuthentication('system.internals.ai');

        const client = await createAiClient();

        let generatedImage: string | undefined;
        let generatedText: string | undefined;

        switch (data.model) {
            case 'image': {
                const attachments = data.attachment
                    ? await Promise.all(data.attachment.map(async entry => ({
                        bytes: await entry.bytes(),
                        mimeType: entry.type,
                    })))
                    : undefined;

                const response = await client.safeGenerateImage({
                    aspectRatio: '4:3',
                    attachments,
                    prompt: data.prompt,
                });

                if (!response.success)
                    return { success: false, error: response.error };

                generatedImage = response.data;
                break;
            }

            case 'text': {
                const response = await client.safeGenerateText({
                    complexity: 'low',
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
        await requireAuthentication('system.internals.ai');

        const exampleMessages = await writeExampleMessages(data.exampleMessages as string[]);

        const prompt = PromptFactory.createById('personality-description-prompt');
        if (!prompt)
            notFound();

        const executor = PromptExecutor.forPrompt(prompt);
        const personality = await executor.execute({
            input: JSON.stringify(exampleMessages),
        });

        if (!personality.success)
            return { success: false, error: 'Unable to generate the default style description' };

        await writeSetting('ai-communication-personality-prompt', personality.text);

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
    textModelHigh: z.enum(kAiSupportedModelIdentifiers),
    textModelLow: z.enum(kAiSupportedModelIdentifiers),
    textModelMedium: z.enum(kAiSupportedModelIdentifiers),
    geminiApiKey: z.string().nonempty(),
    geminiApi: z.enum([ 'Gemini', 'GeminiEnterprise' ]),

    temperature: z.number().min(0).max(2),
    thinkingLevel: z.enum([ 'minimal', 'low', 'medium', 'high' ]),
    topP: z.number().min(0).max(1),
});

/**
 * Server action to update the model settings used by the system globally.
 */
export async function updateModelSettings(formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateModelSettingsData, async (data, props) => {
        await requireAuthentication('system.internals.ai');

        await writeSettings({
            'ai-setting-gemini-api-key': data.geminiApiKey,
            'ai-setting-gemini-api': data.geminiApi,
            'ai-setting-image-model': data.imageModel,
            'ai-setting-text-model-high': data.textModelHigh,
            'ai-setting-text-model-low': data.textModelLow,
            'ai-setting-text-model-medium': data.textModelMedium,
            'ai-setting-temperature': data.temperature,
            'ai-setting-thinking-level': data.thinkingLevel,
            'ai-setting-top-p': data.topP,
        });

        LogBuilder.for('UpdateIntegrationSettings')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                integration: 'Generative AI',
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
    complexity: z.enum([ 'low', 'medium', 'high' ]).optional(),
});

/**
 * Server action to update the system prompt used in generated communication.
 */
export async function updatePrompt(formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdatePromptData, async (data, props) => {
        await requireAuthentication('system.internals.ai');

        const prompt = PromptFactory.createById(data.id, data.prompt);
        if (!prompt)
            notFound();

        const promptValidator = PromptValidator.forPrompt(prompt);

        const verdict = await promptValidator.validate();
        if (!verdict.ok)
            return { success: false, error: verdict.errors.join('\n') };

        LogBuilder.for('UpdateAiPrompt')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                prompt: prompt.metadata.label,
            });

        await writeSetting(prompt.metadata.settings.prompt, data.prompt);
        if (!!data.complexity && !!prompt.metadata.settings.complexity)
            await writeSetting(prompt.metadata.settings.complexity, data.complexity);

        return { success: true };
    });
}
