// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { TextareaAutosizeElement } from 'react-hook-form-mui';

import Grid from '@mui/material/Grid';
import GroupsIcon from '@mui/icons-material/Groups';
import Typography from '@mui/material/Typography';

import { FormGrid } from '@app/admin/components/FormGrid';
import { HiddenInput } from '@components/HiddenInput';
import { NardoPersonalisedAdvicePrompt } from '@lib/ai/prompts/NardoPersonalisedAdvicePrompt';
import { PersonalisedAdviceExample } from './PersonalisedAdviceExample';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
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
        personalisedAdvicePrompt.metadata.settings.prompt,
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
        prompt: settings[personalisedAdvicePrompt.metadata.settings.prompt],
    };

    return (
        <>
            <Section icon={ <GroupsIcon color="primary" /> } title="Del a Rie Advies"
                     breadcrumbs={[
                        { label: 'System', href: '/admin/system' },
                        { label: 'AI', href: '/admin/system/ai' },
                        { label: 'Del a Rie Advies' },
                     ]}>
                <SectionIntroduction>
                    Our friends from Del a Rie Advies are known to leverage any and all state of the
                    art technologies, whether it's helpful or not.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <FormGrid action={actions.updatePrompt} defaultValues={defaultValues}>
                     <Grid size={{ xs: 12 }} sx={{ my: -1 }}>
                        <Typography variant="h6">
                            Model selection
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TokenOverviewAlert prompt={personalisedAdvicePrompt} />
                        <HiddenInput name="id" />
                        <TextareaAutosizeElement name="prompt" label="Personalised advice"
                                                 size="small" fullWidth sx={{ mt: 2 }} />
                    </Grid>
                </FormGrid>
            </Section>
            <Section noHeader>
                <PersonalisedAdviceExample action={executeNardoPersonalisedAdvicePrompt}
                                           advice={advice} events={events} volunteers={volunteers}
                                           userId={user.id} />
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Del a Rie Advies | Artificial Intelligence | AnimeCon Volunteer Manager',
};
