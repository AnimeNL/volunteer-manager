// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { TextFieldElement } from '@components/proxy/react-hook-form-mui';

import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import PublicIcon from '@mui/icons-material/Public';
import Stack from '@mui/material/Stack';

import type { EnvironmentPurpose } from '@lib/database/Types';
import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEnvironments, tTeams } from '@lib/database';

import { createEnvironment } from '../TeamsActions';

/**
 * Human-readable description of the purposes of different environments.
 */
const kPurposeDescription: { [key in EnvironmentPurpose]: string } = {
    LandingPage: 'Landing page',
    Placeholder: 'Placeholder',
};

/**
 * Data source used to populate the environments table.
 */
const environmentsDataSource = createDataSource('organisation/structure/environments', withRowModel({
    /**
     * Unique ID of the environment.
     */
    id: z.number(),

    /**
     * Domain through which the environment can be reached.
     */
    domain: z.string(),

    /**
     * Title of the environment.
     */
    title: z.string(),

    /**
     * Purpose of the environment in human-readable form.
     */
    purpose: z.string(),

    /**
     * Which team(s) are served through this domain?
     */
    teams: z.array(z.number()),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, 'organisation.environments');
    },

    async list(params) {
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
                teams: dbInstance.aggregateAsArrayOfOneColumn(teamsJoin.teamId),
            })
            .groupBy(tEnvironments.environmentId)
            .orderBy(
                params.sort.field === 'title' ? 'title'
                    : params.sort.field === 'purpose' ? 'purpose'
                    : 'domain',
                params.sort.direction)
            .executeSelectMany();

        return {
            rowCount: environments.length,
            rows: environments.map(row => ({
                ...row,
                purpose: kPurposeDescription[row.purpose] ?? row.purpose,
            })),
        };
    },
});

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
            domain: tEnvironments.environmentDomain,
            teams: dbInstance.aggregateAsArray({
                flagManagesContent: teamsJoin.teamFlagManagesContent,
            }),
        })
        .groupBy(tEnvironments.environmentId)
        .executeSelectMany();

    const teamValueOptions = await dbInstance.selectFrom(tTeams)
        .where(tTeams.teamDeleted.isNull())
        .select({
            value: tTeams.teamId,
            label: tTeams.teamName,
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

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

    const columns: Column<ExtractRowModel<typeof environmentsDataSource>>[] = [
        {
            field: 'domain',
            headerName: 'Environment',
            sortable: true,
            flex: 1,

            template: 'text',
            templateProps: {
                href: '/admin/organisation/structure/environments/{domain}',
            },
        },
        {
            field: 'title',
            headerName: 'Title',
            sortable: true,
            flex: 1,
        },
        {
            field: 'purpose',
            headerName: 'Purpose',
            sortable: true,
            flex: 1,
        },
        {
            display: 'flex',
            field: 'teams',
            headerName: 'Teams',
            sortable: false,
            flex: 2,

            type: 'multiSelect',
            valueOptions: teamValueOptions,
        },
    ];

    return (
        <>
            <Section icon={ <PublicIcon color="primary" /> } title="Environments"
                     documentation="organisation/structure" breadcrumbs={[
                { label: 'Organisation', href: '/admin/organisation' },
                { label: 'Structure', href: '/admin/organisation/structure' },
                { label: 'Environments' },
            ]}>
                <SectionIntroduction>
                    Environments are the <em>tenant</em> domains that the Volunteer Manager provides
                    functionality on.
                </SectionIntroduction>
            </Section>
            { warnings.length > 0 &&
                <Stack direction="column" spacing={2}>
                    { warnings.map((warning, index) =>
                        <Alert key={index} severity="warning">
                            <Link href={`/admin/organisation/structure/environments/${warning.environment}`}>
                                <strong>{warning.environment}</strong>
                            </Link> {warning.message}
                        </Alert> )}
                </Stack> }
            <Section noHeader tabs>
                <DataTable columns={columns} source={environmentsDataSource}
                           defaultSort={{ field: 'domain', sort: 'asc' }}
                           disableFooter pageSize={25}
                           listViewProps={{
                               primaryField: 'domain',
                               secondaryTemplate: '{title} ({purpose})',
                               linkTemplate: '/admin/organisation/structure/environments/{domain}',
                           }} />
            </Section>
            { canCreateEnvironments &&
                <FormGridSection icon={ <AddCircleOutlineOutlinedIcon /> }
                                 title="Create a new environment"
                                 action={createEnvironment} callToAction="Create">
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="domain" label="Domain" fullWidth size="small"
                                          placeholder="example.com" required />
                    </Grid>
                </FormGridSection> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Environments', 'Structure', 'Organisation');
