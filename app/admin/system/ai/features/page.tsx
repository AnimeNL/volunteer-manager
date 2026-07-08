// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from '@app/LinkProxy';

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SmartToyIcon from '@mui/icons-material/SmartToy';

import { PromptIcon } from '../PromptIcon';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
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
            metadata: promptInstance.metadata,
        };
    }).filter(({ metadata }) => { return metadata.type === 'Feature'
    }).sort((lhs, rhs) => lhs.metadata.label.localeCompare(rhs.metadata.label));

    return (
        <>
            <Section icon={ <SmartToyIcon color="primary" /> } title="Features"
                     breadcrumbs={[
                        { label: 'System', href: '/admin/system' },
                        { label: 'AI', href: '/admin/system/ai' },
                        { label: 'Features' },
                     ]}>
                <SectionIntroduction>
                    Various features on the Volunteer Manager are powered by AI.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <List disablePadding dense>
                    { availablePrompts.map(({ metadata }) =>
                        <ListItemButton key={metadata.id} LinkComponent={Link}
                                        href={`./features/${metadata.id}`}>
                            <ListItemIcon sx={{ width: 40 }}>
                                <PromptIcon id={metadata.id} />
                            </ListItemIcon>
                            <ListItemText primary={metadata.label}
                                          secondary={metadata.description} />
                        </ListItemButton> )}
                </List>
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Features | Artificial Intelligence | AnimeCon Volunteer Manager',
};
