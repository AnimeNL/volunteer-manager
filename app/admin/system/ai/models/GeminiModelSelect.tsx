// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useMemo } from 'react';

import { SelectElement, useFormContext } from '@components/proxy/react-hook-form-mui';

import IconButton from '@mui/material/IconButton';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import { kAiSupportedModels } from '@lib/integrations/genai/Models';

/**
 * Props accepted by the <GeminiModelSelect> component.
 */
interface GeminiModelSelectProps {
    /**
     * Name to associate the form field with.
     */
    name: string;

    /**
     * Label to visually identify the form field with.
     */
    label: string;
}

/**
 * The <GeminiModelSelect> is a client-side component that displays an interactive select box where
 * a particular Gemini AI model can be selected. It'll offer a link out to the model information
 * page, where additional context can be learned.
 */
export function GeminiModelSelect(props: GeminiModelSelectProps) {
    const { watch } = useFormContext();

    const options = useMemo(() => {
        return Object.entries(kAiSupportedModels).map(([ identifier, information ]) => ({
            id: identifier,
            label: information.name,
        }));
    }, [ /* no dependencies */ ]);

    const value = watch(props.name);
    const model = kAiSupportedModels[value as keyof typeof kAiSupportedModels];

    return (
        <Stack direction="row" spacing={2} alignItems="center">
            <SelectElement name={props.name} label={props.label} fullWidth size="small"
                           options={options} />
            <Tooltip title="Model details…">
                <IconButton LinkComponent={Link} disabled={!model} href={model?.url}
                            size="small" target="_blank">
                    <OpenInNewIcon color={ !model ? 'disabled' : 'info' } />
                </IconButton>
            </Tooltip>
        </Stack>
    );
}
