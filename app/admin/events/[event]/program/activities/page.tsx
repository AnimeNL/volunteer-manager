// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import EventNoteIcon from '@mui/icons-material/EventNote';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { ActivityLocationCell, ActivityTitleCell, AnPlanLinkCell, AnPlanLinkHeader,
    HelpRequestedCell, HelpRequestedHeader, VisibleCell, VisibleHeader } from '../ProgramCells';
import { DataTable } from '@app/admin/components/DataTable';
import { HistorySection } from '../HistorySection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { programActivitiesDataSource } from './ProgramActivitiesDataSource';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tActivitiesLocations } from '@lib/database';

/**
 * The <ProgramActivitiesPage> component lists all activities part of the event's program.
 */
export default async function ProgramActivitiesPage(
    props: PageProps<'/admin/events/[event]/program/activities'>)
{
    const { event } = await requireAuthenticationWithEvent(props);
    if (!event.integrations?.anPlanFestivalId)
        notFound();

    const locations = await db.selectFrom(tActivitiesLocations)
        .where(tActivitiesLocations.locationFestivalId.equals(event.integrations.anPlanFestivalId))
            .and(tActivitiesLocations.locationDeleted.isNull())
        .select({
            value: tActivitiesLocations.locationId,
            label: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const columns: Column<ExtractRowModel<typeof programActivitiesDataSource>>[] = [
        {
            field: 'anplanLink',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: AnPlanLinkHeader,
                component: AnPlanLinkCell,
            },
        },
        {
            field: 'title',
            headerName: 'Activity',
            editable: true,
            sortable: true,
            flex: 2,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: ActivityTitleCell,
            },
        },
        {
            field: 'locationId',
            headerName: 'Location',
            editable: true,
            sortable: false,
            flex: 1,

            type: 'singleSelect',
            valueOptions: locations,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: ActivityLocationCell,
            },
        },
        {
            field: 'helpRequested',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            description: 'Is volunteer help required?',
            editable: true,
            sortable: true,
            width: 50,

            type: 'boolean',

            template: 'component',
            templateProps: {
                headerComponent: HelpRequestedHeader,
                component: HelpRequestedCell,
            },
        },
        {
            field: 'visible',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            sortable: true,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: VisibleHeader,
                component: VisibleCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <EventNoteIcon color="primary" /> } title="Activities"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Program', href: `/admin/events/${event.slug}/program` },
                         { label: 'Activities' },
                     ]}>
                <SectionIntroduction>
                    Activities that are part of {event.shortName}, synchronized from AnPlan.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={programActivitiesDataSource}
                           context={{ event: event.slug }} pageSize={50}
                           defaultSort={{ field: 'title', sort: 'asc' }}
                           frozenColumn="isFrozen" protectedColumn="isProtected"
                           search="prominent" subject="activity"
                           listViewProps={{
                               primaryField: 'title',
                               secondaryField: 'location',
                               startComponent: VisibleCell,
                               linkTemplate: './activities/{id}',
                           }} />
            </Section>
            <HistorySection event={event.slug} scope="activities" />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Activities', 'Program', { event: 'event' });
