// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { writeSettings } from '@lib/Settings';

/**
 * Interface definition for the Generative AI API, exposed through /api/ai.
 */
export const kUpdateAiSettingsDefinition = z.object({
    request: z.object({
        /**
         * Personality that should be updated.
         */
        personality: z.string().optional(),

        /**
         * System instruction(s) that should be updated.
         */
        systemInstruction: z.string().optional(),

        /**
         * Prompts that should be updated.
         */
        prompts: z.object({
            'gen-ai-intention-approve-volunteer': z.string(),
            'gen-ai-intention-cancel-participation': z.string(),
            'gen-ai-intention-change-team': z.string(),
            'gen-ai-intention-reinstate-participation': z.string(),
            'gen-ai-intention-reject-volunteer': z.string(),
            'gen-ai-intention-remind-participation': z.string(),
        }).optional(),

    }),
    response: z.strictObject({
        /**
         * Whether the settings were updated successfully.
         */
        success: z.boolean(),
    }),
});

export type UpdateAiSettingsDefinition = ApiDefinition<typeof kUpdateAiSettingsDefinition>;

type Request = ApiRequest<typeof kUpdateAiSettingsDefinition>;
type Response = ApiResponse<typeof kUpdateAiSettingsDefinition>;

/**
 * API that allows AI-related settings to be updated.
 */
export async function updateSettings(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, {
        check: 'admin',
        permission: 'system.internals.ai',
    });

    if (request.personality || request.systemInstruction) {
        await writeSettings({
            'gen-ai-personality': request.personality,
            'gen-ai-system-instruction': request.systemInstruction,
        });

        RecordLog({
            type: kLogType.AdminUpdateAiSetting,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                setting: 'personality',
            },
        });
    }

    if (request.prompts) {
        await writeSettings({
            'gen-ai-intention-approve-volunteer':
                request.prompts['gen-ai-intention-approve-volunteer'],
            'gen-ai-intention-cancel-participation':
                request.prompts['gen-ai-intention-cancel-participation'],
            'gen-ai-intention-change-team':
                request.prompts['gen-ai-intention-change-team'],
            'gen-ai-intention-reinstate-participation':
                request.prompts['gen-ai-intention-reinstate-participation'],
            'gen-ai-intention-reject-volunteer':
                request.prompts['gen-ai-intention-reject-volunteer'],
            'gen-ai-intention-remind-participation':
                request.prompts['gen-ai-intention-remind-participation'],
        });

        RecordLog({
            type: kLogType.AdminUpdateAiSetting,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                setting: 'intentions',
            },
        });
    }

    return { success: true };
}
