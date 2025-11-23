// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { createVertexAIClient } from '@lib/integrations/vertexai';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { readSettings } from '@lib/Settings';

import { kVertexSupportedModelIdentifiers } from '@lib/integrations/vertexai/VertexSupportedModels';

/**
 * The Vertex AI settings object. Shared across multiple API calls.
 */
export const kVertexAiSettings = z.object({
    model: z.enum(kVertexSupportedModelIdentifiers),
    temperature: z.number().gte(0).lte(1),
    tokenLimit: z.number().gte(1).lte(1024),
    topK: z.number().gte(1).lte(40),
    topP: z.number().gte(0).lte(1),
});

/**
 * Interface definition for the Vertex AI API, exposed through /api/admin/vertex-ai.
 */
export const kVertexAiDefinition = z.object({
    request: z.object({
        /**
         * The prompt that should be input to the LLM generation model. Must not be empty.
         */
        prompt: z.string().nonempty(),

        /**
         * Settings that should be considered when making an API call. Will be fetched from the
         * database when omitted, only applicable to configuration pages.
         */
        settings: kVertexAiSettings.optional(),
    }),
    response: z.strictObject({
        /**
         * The result as it has been generated. Empty if an error occurred.
         */
        result: z.string().optional(),
    }),
});

export type VertexAiDefinition = ApiDefinition<typeof kVertexAiDefinition>;

type Request = ApiRequest<typeof kVertexAiDefinition>;
type Response = ApiResponse<typeof kVertexAiDefinition>;

/**
 * API that allows the administrative section to communicate with the Google Vertex AI APIs. Will
 * use the settings stored in the database when they are not set in the request.
 */
export async function vertexAi(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, {
        check: 'admin',
        permission: 'system.internals.settings',
    });

    const { settings } = request;

    const defaultSettings = await readSettings([
        // Google:
        'integration-google-apikey',
        'integration-google-credentials',
        'integration-google-location',
        'integration-google-project-id',

        // Google Vertex AI:
        'integration-vertex-model',
        'integration-vertex-temperature',
        'integration-vertex-token-limit',
        'integration-vertex-top-k',
        'integration-vertex-top-p',
    ]);

    const client = await createVertexAIClient({
        apiKey: defaultSettings['integration-google-apikey']!,
        credentials: defaultSettings['integration-google-credentials']!,
        location: defaultSettings['integration-google-location']!,
        projectId: defaultSettings['integration-google-project-id']!,

        model: settings?.model ?? defaultSettings['integration-vertex-model']!,
        temperature: settings?.temperature ?? defaultSettings['integration-vertex-temperature']!,
        tokenLimit: settings?.tokenLimit ?? defaultSettings['integration-vertex-token-limit']!,
        topK: settings?.topK ?? defaultSettings['integration-vertex-top-k']!,
        topP: settings?.topP ?? defaultSettings['integration-vertex-top-p']!,
    });

    return {
        result: await client.predictText({ prompt: request.prompt })
    };
}
