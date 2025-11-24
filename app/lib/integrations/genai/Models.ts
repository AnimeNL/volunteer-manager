// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Enumeration of the models that are supported by the Gen AI API.
 */
export const kAiSupportedModels = {
    'gemini-3-pro-image-preview': {
        name: 'Gemini 3 Pro (Nano Banana Pro) (Preview)',
        url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image',
    },
    'gemini-3-pro-preview': {
        name: 'Gemini 3 Pro (Preview)',
        url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro',
    },
    'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash',
    },
    'gemini-2.5-flash-image': {
        name: 'Gemini 2.5 Flash (Nano Banana)',
        url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image',
    },
    'gemini-2.5-flash-lite': {
        name: 'Gemini 2.5 Flash (Lite)',
        url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite',
    },
    'gemini-2.0-flash': {
        name: 'Gemini 2 Flash',
        url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-0-flash',
    },
    'gemini-2.0-flash-001': {
        name: 'Gemini 2 Flash (Preview)',
        url: 'https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-0-flash',
    },
    'gemini-2.0-flash-lite': {
        name: 'Gemini 2 Flash (Lite)',
        url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-0-flash-lite',
    },
} as const;

/**
 * Enumeration of the model identifiers that are supported by the Gen AI API.
 */
export const kAiSupportedModelIdentifiers: { [k in keyof typeof kAiSupportedModels ]: k } =
    Object.fromEntries(Object.keys(kAiSupportedModels).map(modelIdentifier =>
        [ modelIdentifier, modelIdentifier ])) as any;

/**
 * Enumeration of the models that are supported by the Gen AI API.
 */
export type AiSupportedModel =
    typeof kAiSupportedModelIdentifiers[keyof typeof kAiSupportedModelIdentifiers];
