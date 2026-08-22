// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, redirect } from 'next/navigation';

import { SelectElement, TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { FormGrid } from '@app/admin/components/FormGrid';
import { TeamsDataTable } from './TeamsDataTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEnvironments, tTeams } from '@lib/database';

import * as actions from './TeamsActions';

/**
 * The <TeamsPage> component enables the volunteer to list and alter the teams that exist on the
 * Volunteer Manager. Teams are highly configurable entities and can either be managed separately,
 * or jointly together with one or more other teams.
 */
export default async function TeamsPage() {
    const { access } = await requireAuthentication();
    if (!access.can('organisation.teams')) {
        if (access.can('organisation.environments'))
            redirect('/admin/organisation/structure/environments');

        if (access.can('organisation.roles'))
            redirect('/admin/organisation/structure/roles');

        forbidden();
    }

    let environments: { id: number; label: string }[] = [ /* empty */ ];

    const canCreateTeams = access.can('root');  // only root can create new teams
    if (canCreateTeams) {
        environments = await db.selectFrom(tEnvironments)
            .where(tEnvironments.environmentDeleted.isNull())
            .select({
                id: tEnvironments.environmentId,
                label: tEnvironments.environmentTitle
                    .concat(' (')
                    .concat(tEnvironments.environmentDomain)
                    .concat(')'),
            })
            .orderBy(tEnvironments.environmentTitle, 'asc')
            .executeSelectMany();
    }

    const environmentsJoin = tEnvironments.forUseInLeftJoin();
    const teams = await db.selectFrom(tTeams)
        .leftJoin(environmentsJoin)
            .on(environmentsJoin.environmentId.equals(tTeams.teamEnvironmentId))
                .and(environmentsJoin.environmentDeleted.isNull())
        .select({
            id: tTeams.teamId,
            slug: tTeams.teamSlug,

            title: tTeams.teamTitle,

            name: tTeams.teamName,
            color: tTeams.teamColourLightTheme,

            domain: environmentsJoin.environmentDomain,
            enabled: tTeams.teamDeleted.isNull(),
        })
        .orderBy('enabled', 'desc')
            .orderBy('title', 'asc')
        .executeSelectMany();

    return (
        <>
            <TeamsDataTable teams={teams} />
            { canCreateTeams &&
                <>
                    <Divider sx={{ mt: 2, mb: 1 }} />
                    <FormGrid action={actions.createTeam} callToAction="Create">
                        <Grid size={{ xs: 12 }} sx={{ mb: -1 }}>
                            <Typography variant="h6">
                                Create a new team
                            </Typography>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="slug" label="Slug" fullWidth size="small"
                                              required />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SelectElement name="environment" label="Environment" fullWidth
                                           size="small" required options={environments} />
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="title" label="Team title" fullWidth size="small"
                                              required />
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <TextFieldElement name="name" label="Team name" fullWidth size="small"
                                              required />
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <TextFieldElement name="plural" label="Team plural" fullWidth
                                              size="small" required />
                        </Grid>

                    </FormGrid>
                </> }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Teams', 'Organisation');
