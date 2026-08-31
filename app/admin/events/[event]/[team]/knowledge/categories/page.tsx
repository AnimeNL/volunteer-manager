// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import CategoryIcon from '@mui/icons-material/Category';

import type { Column } from '@app/admin/components/DataTable';
import type { KnowledgeCategoriesRowModel } from './KnowledgeCategoriesDataSource';
import { CategoryIconCell, CategoryIconHeader } from './KnowledgeCategoriesCells';
import { DataTable } from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { knowledgeCategoriesDataSource } from './KnowledgeCategoriesDataSource';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tEventsTeams, tRoles, tTeams, tTeamsRoles } from '@lib/database';

import { kKnowledgeBaseIconTable } from '@components/KnowledgeBaseIconTable';

/**
 * The category overview page displays all categories that questions in the knowledge base can be
 * associated with, and allows managing them.
 */
export default async function KnowledgeCategoriesPage(
    props: PageProps<'/admin/events/[event]/[team]/knowledge/categories'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props);
    if (!team.flags.managesKnowledgeBase)
        notFound();

    // TODO: Re-enable reordering the rows when that's supported.

    const dbInstance = db;
    const availableRoles = await dbInstance.selectFrom(tEventsTeams)
        .innerJoin(tTeamsRoles)
            .on(tTeamsRoles.teamId.equals(tEventsTeams.teamId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tTeamsRoles.roleId))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            value: tRoles.roleId,
            label: tRoles.roleName,
        })
        .groupBy(tRoles.roleId)
        .orderBy('label', 'asc')
        .executeSelectMany();

    const availableTeams = await dbInstance.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            value: tTeams.teamId,
            label: tTeams.teamName,
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const columns: Column<KnowledgeCategoriesRowModel>[] = [
        {
            display: 'flex',
            field: 'icon',
            headerAlign: 'center',
            headerName: /* empty= */ '',
            align: 'center',
            editable: true,
            sortable: false,
            width: 50,

            type: 'singleSelect',
            valueOptions: Object.keys(kKnowledgeBaseIconTable).sort().map(
                icon => ({ value: icon, label: icon })),

            template: 'component',
            templateProps: {
                component: CategoryIconCell,
                headerComponent: CategoryIconHeader,
            },
        },
        {
            field: 'title',
            headerName: 'Title',
            editable: true,
            sortable: true,
            flex: 1,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'description',
            headerName: 'Description',
            editable: true,
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                defaultValue: 'No description…',
            },
        },
        {
            field: 'roles',
            headerName: 'Restrict to roles…',
            editable: true,
            sortable: false,
            flex: 1,

            type: 'multiSelect',
            valueOptions: availableRoles,
        },
        {
            field: 'teams',
            headerName: 'Restrict to teams…',
            editable: true,
            sortable: false,
            flex: 1,

            type: 'multiSelect',
            valueOptions: availableTeams,
        },
        {
            field: 'order',
            headerName: 'Order',
            align: 'center',
            headerAlign: 'center',
            editable: true,
            sortable: true,
            type: 'number',
            width: 75,
        },
    ];

    return (
        <>
            <Section icon={ <CategoryIcon color="primary" /> } title="Categories"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Knowledge base',
                             href: `/admin/events/${event.slug}/${team.slug}/knowledge`,
                         },
                         { label: 'Categories' },
                     ]}>
                <SectionIntroduction>
                    Questions in the knowledge based are grouped by category, to make them easier
                    for people to navigate.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={knowledgeCategoriesDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'order', sort: 'asc' }}
                           pageSize={100} disableFooter subject="category"
                           listViewProps={{
                               primaryField: 'title',
                               secondaryField: 'description',
                               startComponent: CategoryIconCell,
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Knowledge base', { team: 'team' }, { event: 'event' });
