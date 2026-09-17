// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, redirect } from 'next/navigation';
import { z } from 'zod/v4';

import { SelectElement, TextFieldElement } from '@components/proxy/react-hook-form-mui';

import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import Grid from '@mui/material/Grid';
import GroupsIcon from '@mui/icons-material/Groups';

import { BadgeCell, TeamEnabledCell, TeamEnabledHeaderCell } from './StructureCells';
import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEnvironments, tTeams } from '@lib/database';

import * as actions from './TeamsActions';

/**
 * Data source used to populate the teams table.
 */
const teamsDataSource = createDataSource('organisation/structure/teams', withRowModel({
    /**
     * Unique ID of the team.
     */
    id: z.number(),

    /**
     * URL-safe slug through which the team is identifiable through a URL.
     */
    slug: z.string(),

    /**
     * Title of the team, as it should be presented in print.
     */
    title: z.string(),

    /**
     * Name of the team, as it should be presented in brief.
     */
    name: z.string(),

    /**
     * RGB colour that indicates this team. Will be used on their badge.
     */
    color: z.string(),

    /**
     * Domain name through which this team's schedules are served.
     */
    domain: z.string().optional(),

    /**
     * Whether the team is enabled or not.
     */
    enabled: z.boolean(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'organisation.teams',
            operation: 'read',
        });
    },

    async list(params) {
        const environmentsJoin = tEnvironments.forUseInLeftJoin();

        const dbInstance = db;
        const teams = await dbInstance.selectFrom(tTeams)
            .leftJoin(environmentsJoin)
                .on(environmentsJoin.environmentId.equals(tTeams.teamEnvironmentId))
                    .and(environmentsJoin.environmentDeleted.isNull())
            .where(
                tTeams.teamTitle.containsInsensitiveIfValue(params.search).or(
                tTeams.teamName.containsInsensitiveIfValue(params.search).or(
                environmentsJoin.environmentDomain.containsInsensitiveIfValue(params.search))))
            .select({
                id: tTeams.teamId,
                slug: tTeams.teamSlug,
                title: tTeams.teamTitle,
                name: tTeams.teamName,
                color: tTeams.teamColourLightTheme,
                domain: environmentsJoin.environmentDomain,
                enabled: tTeams.teamDeleted.isNull(),
            })
            .orderBy(
                params.sort.field === 'title' ? 'title'
                    : params.sort.field === 'domain' ? 'domain'
                    : 'enabled',
                params.sort.direction)
            .executeSelectMany();

        return {
            rowCount: teams.length,
            rows: teams,
        };
    },
});

/**
 * The <TeamsPage> component enables the volunteer to list and alter the teams that exist on the
 * Volunteer Manager. Teams are highly configurable entities and can either be managed separately,
 * or jointly together with one or more other teams.
 */
export default async function TeamsPage() {
    const { access } = await requireAuthentication();
    if (!access.can('organisation.teams', 'read')) {
        if (access.can('organisation.environments', 'read'))
            redirect('/admin/organisation/structure/environments');

        if (access.can('organisation.roles', 'read'))
            redirect('/admin/organisation/structure/roles');

        forbidden();
    }

    let environments: { id: number; label: string }[] = [ /* empty */ ];

    const canCreateTeams = access.can('organisation.teams', 'create');
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

    const columns: Column<ExtractRowModel<typeof teamsDataSource>>[] = [
        {
            field: 'enabled',
            headerAlign: 'center',
            align: 'center',
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: TeamEnabledHeaderCell,
                component: TeamEnabledCell,
            },
        },
        {
            field: 'title',
            headerName: 'Team',
            sortable: true,
            flex: 1,

            template: 'text',
            templateProps: {
                href: './structure/{slug}',
            },
        },
        {
            field: 'domain',
            headerName: 'Domain',
            sortable: true,
            flex: 1,

            template: 'text',
            templateProps: {
                href: './structure/environments/{domain}',
            },
        },
        {
            field: 'name',
            headerName: 'Badge',
            sortable: false,
            flex: 1,

            template: 'component',
            templateProps: {
                component: BadgeCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <GroupsIcon color="primary" /> } title="Teams"
                     documentation="organisation/structure" breadcrumbs={[
                { label: 'Organisation', href: '/admin/organisation' },
                { label: 'Structure' },
                { label: 'Teams' },
            ]}>
                <SectionIntroduction>
                    Teams that are managed by the Volunteer Manager and may participate in events.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={teamsDataSource}
                           defaultSort={{ field: 'title', sort: 'asc' }}
                           disableFooter pageSize={25}
                           listViewProps={{
                               primaryField: 'title',
                               secondaryField: 'domain',
                               linkTemplate: '/admin/organisation/structure/{slug}',
                               startComponent: TeamEnabledCell,
                           }} />
            </Section>
            { canCreateTeams &&
                <FormGridSection icon={ <AddCircleOutlineOutlinedIcon /> }
                                 title="Create a new team" action={actions.createTeam}
                                 callToAction="Create">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextFieldElement name="slug" label="Slug" fullWidth size="small"
                                          required placeholder="myteam" />
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
                </FormGridSection> }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Structure', 'Organisation');
