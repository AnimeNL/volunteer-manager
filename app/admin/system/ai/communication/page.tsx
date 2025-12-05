// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from '@app/LinkProxy';

import { TextareaAutosizeElement } from 'react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import HotelIcon from '@mui/icons-material/Hotel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import RepeatIcon from '@mui/icons-material/Repeat';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FormGrid } from '@app/admin/components/FormGrid';
import { HiddenInput } from '@components/HiddenInput';
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
 * Icons to visually identify the prompts with. They're indexed by the name of the constructor.
 */
const kPromptIcons: { [k in keyof typeof prompts]?: React.JSX.Element } = {
    HotelConfirmationPrompt: <HotelIcon color="primary" />,
    RetentionPrompt: <RepeatIcon color="primary" />
};

/**
 * The communication page contains the settings and prompts used for generated messages coming from
 * the Volunteer Manager. Each individual setting has its own sub page.
 */
export default async function CommunicationAiPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const settings =
        await readSettings([ 'ai-communication-system-prompt', 'ai-example-messages' ]);

    const exampleMessages = JSON.parse(settings['ai-example-messages'] || '[]');

    const systemPromptTemplate = settings['ai-communication-system-prompt'] || '';
    const systemPrompt = new SystemPrompt();

    // Infer the available prompts from the ones exported from the //lib/ai/ library,
    // which is the source of truth. Icons are complemented by this component.
    const availablePrompts = Object.values(prompts).map(promptConstructor => {
        const promptInstance = new promptConstructor();
        return {
            name: promptConstructor.name,
            metadata: promptInstance.metadata,
        };
    }).filter(({ metadata }) => { return !('hidden' in metadata)
    }).sort((lhs, rhs) => lhs.metadata.label.localeCompare(rhs.metadata.label));

    return (
        <>
            <Stack direction="column" spacing={2} sx={{ mb: 2 }}>
                <List disablePadding dense>
                    { availablePrompts.map(({ name, metadata }) =>
                        <ListItemButton key={metadata.id} LinkComponent={Link}
                                        href={`./communication/${metadata.id}`}>
                            <ListItemIcon>
                                {kPromptIcons[name as keyof typeof prompts]}
                            </ListItemIcon>
                            <ListItemText primary={metadata.label}
                                          secondary={metadata.description} />
                        </ListItemButton> )}
                </List>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <FormGrid action={actions.updatePrompt}
                      defaultValues={{ id: 'system', prompt: systemPromptTemplate }}>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        System prompt
                    </Typography>
                    <TokenOverviewAlert prompt={systemPrompt} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <HiddenInput name="id" />
                    <TextareaAutosizeElement name="prompt" label="System prompt" fullWidth
                                             size="small" />
                </Grid>
            </FormGrid>
            <Divider sx={{ mt: 2, mb: 1 }} />
            <FormGrid action={actions.updateExampleMessages} defaultValues={{ exampleMessages }}>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="h6">
                        Example messages
                    </Typography>
                    <Alert severity="warning" sx={{ mt: '8px !important' }}>
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
            </FormGrid>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Communication | Artificial Intelligence | AnimeCon Volunteer Manager',
};
