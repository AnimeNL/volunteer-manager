// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { TextareaAutosizeElement } from 'react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { FormGrid } from '@app/admin/components/FormGrid';
import { HiddenInput } from '@components/HiddenInput';
import { NardoPersonalisedAdvicePrompt } from '@lib/ai/prompts/NardoPersonalisedAdvicePrompt';
import { PersonalisedAdviceExample } from './PersonalisedAdviceExample';
import { TokenOverviewAlert } from '../TokenOverviewAlert';
import { executeNardoPersonalisedAdvicePrompt } from '@lib/ai/Actions';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents, tNardo, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

import * as actions from '../AiActions';

/**
 * The AI page contains the prompt configuration used for our use of Generative AI throughout the
 * volunteer portal. The page is protected behind a special permission.
 */
export default async function NardoAiPage() {
    const { user } = await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    const personalisedAdvicePrompt = new NardoPersonalisedAdvicePrompt();
    const settings = await readSettings([
        personalisedAdvicePrompt.metadata.setting,
    ]);

    // ---------------------------------------------------------------------------------------------
    // Compose the necessary information to enable the example generators.
    // ---------------------------------------------------------------------------------------------

    const dbInstance = db;
    const advice = await dbInstance.selectFrom(tNardo)
        .where(tNardo.nardoVisible.equals(/* true= */ 1))
        .select({
            id: tNardo.nardoId,
            label: tNardo.nardoAdvice,
        })
        .orderBy(tNardo.nardoAuthorDate, 'desc')
        .executeSelectMany();

    const events = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventHidden.equals(/* false= */ 0))
        .select({
            id: tEvents.eventSlug,
            label: tEvents.eventShortName,
        })
        .orderBy(tEvents.eventEndTime, 'desc')
        .executeSelectMany();

    const volunteers = await dbInstance.selectFrom(tEvents)
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.eventId.equals(tEvents.eventId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tEvents.eventHidden.equals(/* false= */ 0))
            .and(tUsersEvents.registrationStatus.equals( kRegistrationStatus.Accepted ))
            .and(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            label: tUsers.name,
        })
        .groupBy(tUsers.userId)
        .orderBy(tUsers.name)
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------

    const defaultValues = {
        id: 'nardo-personalised-advice',
        prompt: settings[personalisedAdvicePrompt.metadata.setting],
    };

    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
                <Typography variant="h6" sx={{ mb: -1 }}>
                    Personalised Advice
                </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
                <FormGrid action={actions.updatePrompt} defaultValues={defaultValues}>
                    <Grid size={{ xs: 12 }}>
                        <TokenOverviewAlert prompt={personalisedAdvicePrompt} />
                        <HiddenInput name="id" />
                        <TextareaAutosizeElement name="prompt" label="Personalised advice"
                                                 size="small" fullWidth sx={{ mt: 2 }} />
                    </Grid>
                </FormGrid>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
                <PersonalisedAdviceExample action={executeNardoPersonalisedAdvicePrompt}
                                           advice={advice} events={events} volunteers={volunteers}
                                           userId={user.id} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Divider />
            </Grid>
        </Grid>
    );
}

export const metadata: Metadata = {
    title: 'Del a Rie Advies | Artificial Intelligence | AnimeCon Volunteer Manager',
};
