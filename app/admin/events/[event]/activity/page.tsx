// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';

import type { Column } from '@app/admin/components/DataTable';
import type { EventActivityRowModel } from './EventActivityDataSource';
import { ActivityTeamCell, ActivityTypeCell } from './ActivityRowComponents';
import { DataTable } from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { eventActivityDataSource } from './EventActivityDataSource';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * Page that displays recent activity and preference changes made by volunteers for a given event.
 */
export default async function EventActivityPage(props: PageProps<'/admin/events/[event]/activity'>)
{
    const { event } = await requireAuthenticationWithEvent(props);

    const columns: Column<EventActivityRowModel>[] = [
        {
            field: 'type',
            display: 'flex',
            headerName: '',
            sortable: true,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                component: ActivityTypeCell,
            },
        },
        {
            field: 'team',
            display: 'flex',
            headerName: 'Team',
            sortable: true,
            width: 150,

            template: 'component',
            templateProps: {
                component: ActivityTeamCell,
            },
        },
        {
            field: 'user',
            headerName: 'Volunteer',
            sortable: true,
            flex: 1,

            template: 'text',
            templateProps: {
                field: 'user.name',
                href: '{href}',
            },
        },
        {
            field: 'description',
            headerName: 'Description',
            sortable: true,
            flex: 2,

            template: 'text',
        },
        {
            field: 'date',
            headerName: 'Date',
            sortable: true,
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
    ];

    return (
        <>
            <Section icon={ <NotificationsActiveOutlinedIcon color="primary" /> } title="Activity"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Activity' },
                     ]}>
                <SectionIntroduction>
                    Overview of recent changes made by volunteers for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable columns={columns} source={eventActivityDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'date', sort: 'desc' }}
                           subject="change" disableSearch
                           listViewProps={{
                               primaryField: 'description',
                               secondaryTemplate: '{user.name} ({team})',
                               dateField: 'date',
                               dateFieldFormat: 'YYYY-MM-DD HH:mm',
                               linkTemplate: '{href}',
                               startComponent: ActivityTypeCell,
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Activity', { event: 'event' });
