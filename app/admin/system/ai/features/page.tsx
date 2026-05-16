// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from '@app/LinkProxy';

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';

import { PromptIcon } from '../PromptIcon';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import * as prompts from '@lib/ai/prompts';

/**
 * The <AiFeaturesPage> component lists all AI-powered features in the Volunteer Manager, with the
 * ability to inspect, run and change their associated prompts.
 */
export default async function AiFeaturesPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    // Infer the available prompts from the ones exported from the //lib/ai/ library,
    // which is the source of truth. Icons are complemented by this component.
    const availablePrompts = Object.values(prompts).map(promptConstructor => {
        const promptInstance = new promptConstructor();
        return {
            name: promptConstructor.name,
            metadata: promptInstance.metadata,
        };
    }).filter(({ metadata }) => { return metadata.type === 'Feature'
    }).sort((lhs, rhs) => lhs.metadata.label.localeCompare(rhs.metadata.label));

    return (
        <Stack direction="column" spacing={2}>
            <List disablePadding dense>
                { availablePrompts.map(({ name, metadata }) =>
                    <ListItemButton key={metadata.id} LinkComponent={Link}
                                    href={`./features/${metadata.id}`}>
                        <ListItemIcon sx={{ width: 40 }}>
                            <PromptIcon id={name as keyof typeof prompts} />
                        </ListItemIcon>
                        <ListItemText primary={metadata.label}
                                        secondary={metadata.description} />
                    </ListItemButton> )}
            </List>
        </Stack>
    );
}

export const metadata: Metadata = {
    title: 'Features | Artificial Intelligence | AnimeCon Volunteer Manager',
};
