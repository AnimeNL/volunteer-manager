// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Interactions } from '@google/genai';

/**
 * Helper type to pick only the string literals in the given `T`.
 */
type PickStringLiterals<T> = T extends string
    ? string extends T ? never
                       : T
    : never;

/**
 * Type that lists all the models that are supported by the @google/genai library.
 */
type LibrarySupportedAiModels = PickStringLiterals<Interactions.Model>;

/**
 * Enumeration of the models that are supported by the Gen AI API.
 */
export const kAiSupportedModels = {
    'gemini-3.5-flash': {  // EOL: May 19, 2027 or later
        name: 'Gemini 3.5 Flash',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash',
    },
    'gemini-3.1-flash-image': {  // EOL: May 28, 2027 or later
        name: 'Gemini 3.1 Flash (Nano Banana)',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image',
    },
    'gemini-3.1-flash-lite-image': {  // EOL: Not announced
        name: 'Gemini 3.1 Flash (Nano Banana Lite)',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-lite-image',
    },
    'gemini-3.1-flash-lite': {  // EOL: May 7, 2027 or later
        name: 'Gemini 3.1 Flash (Lite)',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-lite',
    },
    'gemini-3.1-pro-preview': {  // EOL: Not announced
        name: 'Gemini 3.1 Pro (Preview)',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-pro',
    },
    'gemini-3-flash-preview': {  // EOL: Not announced
        name: 'Gemini 3 Flash (Preview)',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-flash',
    },
    'gemini-3-pro-image': {  // EOL: May 28, 2027 or later
        name: 'Gemini 3 Pro (Nano Banana Pro)',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-pro-image',
    },
    'gemini-2.5-flash': {  // EOL: Not before October 16, 2026
        name: 'Gemini 2.5 Flash',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/2-5-flash',
    },
    'gemini-2.5-flash-image': {  // EOL: October 2, 2026
        name: 'Gemini 2.5 Flash (Nano Banana)',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/2-5-flash-image',
    },
    'gemini-2.5-flash-lite': {  // EOL: Not before October 16, 2026
        name: 'Gemini 2.5 Flash (Lite)',
        url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/2-5-flash-lite',
    },
} as const satisfies Partial<Record<LibrarySupportedAiModels, { name: string, url: string }>>;

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
