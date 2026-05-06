// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import Skeleton from '@mui/material/Skeleton';
import StreamIcon from '@mui/icons-material/Stream';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createAiClient } from '@lib/integrations/genai';

/**
 * The <SystemDebugAiPage> contains a collection of AI-related test cases.
 */
export default function SystemDebugAiPage() {
    return (
        <>
            <Section title="Artificial Intelligence" subtitle="Debug">
                <SectionIntroduction>
                    Page to test some of the deeper integrations in the Google Generative AI APIs,
                    before rolling them out to a proper library.
                </SectionIntroduction>
            </Section>
            <Section title="Text generation" subtitle="Streaming">
                <Suspense fallback={ <Skeleton height={8} /> }>
                    <StreamTextResponse />
                </Suspense>
            </Section>
            <Section title="Models">
                <Suspense fallback={ <Skeleton height={8} /> }>
                    <ListAvailableModels />
                </Suspense>
            </Section>
        </>
    );
}

/**
 * Asynchronous component that queries the list of models available through our AI client.
 */
async function ListAvailableModels() {
    const client = await createAiClient();
    const models = await client.listModels();

    return (
        <List dense disablePadding>
            {models.map((model, index) =>
                <ListItem key={index} disableGutters>
                    <ListItemIcon>
                        <ModelTrainingIcon />
                    </ListItemIcon>
                    <ListItemText primary={model.name}
                                  secondary={model.version} />
                </ListItem> )}
        </List>
    );
}

/**
 * Asynchronous component that streams a text generation query back to the client.
 */
async function StreamTextResponse() {
    const client = await createAiClient();
    const stream = await client.generateTextStream({
        complexity: 'low',
        prompt: 'Tell me an original story about a rabbit in at least 50 words.',
    });

    const elements: React.ReactNode[] = [ /* none yet */ ];
    for await (const chunk of stream) {
        if (!chunk.text?.length)
            continue;  // empty chunk

        elements.push(
            <ListItem key={elements.length} disableGutters>
                <ListItemIcon>
                    <StreamIcon />
                </ListItemIcon>
                <ListItemText primary={chunk.text} />
            </ListItem>
        );
    }

    return (
        <List dense disablePadding>
            {elements}
        </List>
    );
}
