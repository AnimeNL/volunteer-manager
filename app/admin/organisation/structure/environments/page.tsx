// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { EnvironmentsDataTable } from './EnvironmentsDataTable';
import { FormGrid } from '@app/admin/components/FormGrid';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';
import db, { tEnvironments, tTeams } from '@lib/database';

import * as actions from '../TeamsActions';

/**
 * The <EnvironmentsPage> component enables the volunteer to adjust the environments that exist on
 * the Volunteer Manager. These are the individual landing pages through which the system can be
 * reached, each having its own lightweight personalisation.
 */
export default async function EnvironmentsPage() {
    const { access } = await requireAuthentication('organisation.environments');

    const canCreateEnvironments = access.can('root');  // only root can create new environments

    const teamsJoin = tTeams.forUseInLeftJoin();

    const dbInstance = db;
    const environments = await dbInstance.selectFrom(tEnvironments)
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamEnvironmentId.equals(tEnvironments.environmentId))
                .and(teamsJoin.teamDeleted.isNull())
        .where(tEnvironments.environmentDeleted.isNull())
        .select({
            id: tEnvironments.environmentId,

            domain: tEnvironments.environmentDomain,
            title: tEnvironments.environmentTitle,
            purpose: tEnvironments.environmentPurpose,

            teams: dbInstance.aggregateAsArray({
                name: teamsJoin.teamName,
                color: teamsJoin.teamColourLightTheme,

                flagManagesContent: teamsJoin.teamFlagManagesContent,
            }),
        })
        .groupBy(tEnvironments.environmentId)
        .orderBy(tEnvironments.environmentDomain, 'asc')
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------

    type Warning = {
        environment: string;
        message: string;
    };

    const warnings: Warning[] = [ /* no warnings */ ];
    for (const environment of environments) {
        let numberOfTeamsManagingContent = 0;
        for (const team of environment.teams) {
            if (team.flagManagesContent)
                ++numberOfTeamsManagingContent;
        }

        if (numberOfTeamsManagingContent > 1) {
            warnings.push({
                environment: environment.domain,
                message:
                    'content is being managed by multiple teams, which can lead to unclear ' +
                    'ownership and missing content on the landing page',
            });
        }
    }

    return (
        <>
            { warnings.length > 0 &&
                <>
                    <Stack direction="column" spacing={2}>
                        { warnings.map((warning, index) =>
                            <Alert key={index} severity="warning">
                                <Link href={`./environments/${warning.environment}`}>
                                    <strong>{warning.environment}</strong>
                                </Link> {warning.message}
                            </Alert> )}
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                </> }
            <EnvironmentsDataTable environments={environments} />
            { canCreateEnvironments &&
                <>
                    <Divider sx={{ mt: 2, mb: 1 }} />
                    <FormGrid action={actions.createEnvironment} callToAction="Create">
                        <Grid size={{ xs: 12 }} sx={{ mb: -1 }}>
                            <Typography variant="h6">
                                Create a new environment
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextFieldElement name="domain" label="Domain" fullWidth size="small"
                                              required />
                        </Grid>
                    </FormGrid>
                </> }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Environments', 'Organisation');
