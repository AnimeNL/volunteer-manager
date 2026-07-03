// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { z } from 'zod';

import { default as TopLevelLayout } from '../TopLevelLayout';
import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel } from '@app/admin/components/DataTable';
import { EventSettingsForm } from './[event]/settings/EventSettingsForm';
import { EventStatusCell, EventTeamsCell } from './EventRowComponents';
import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Temporal } from '@lib/Temporal';
import { createEvent } from './createEvent';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents, tEventsTeams, tTeams } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessControl';

/**
 * Data source through which the Events data table can be populated.
 */
const eventDataSource = createDataSource('admin/events', withRowModel({
    id: z.number(),
    hidden: z.boolean(),
    shortName: z.string(),
    slug: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    teams: z.array(z.object({
        name: z.string(),
        themeColor: z.string(),
    })),
}), {
    async authorize(operation, props) {
        await requireAuthenticationContext({
            check: 'admin',
            permission: {
                permission: 'event.visible',
                scope: {
                    event: kAnyEvent,
                    team: kAnyTeam,
                },
            },
        });
    },

    async list(params, props) {
        const dbInstance = db;
        const eventsTeamsJoin = tEventsTeams.forUseInLeftJoin();
        const teamsJoin = tTeams.forUseInLeftJoin();

        const unfilteredEvents = await dbInstance.selectFrom(tEvents)
            .leftJoin(eventsTeamsJoin)
                .on(eventsTeamsJoin.eventId.equals(tEvents.eventId))
                    .and(eventsTeamsJoin.enableTeam.equals(/* true= */ 1))
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamId.equals(eventsTeamsJoin.teamId))
            .select({
                id: tEvents.eventId,
                hidden: tEvents.eventHidden.equals(/* true= */ 1),
                shortName: tEvents.eventShortName,
                slug: tEvents.eventSlug,
                startTime: dbInstance.dateTimeAsString(tEvents.eventStartTime),
                endTime: dbInstance.dateTimeAsString(tEvents.eventEndTime),
                teams: dbInstance.aggregateAsArray({
                    name: teamsJoin.teamName,
                    themeColor: teamsJoin.teamColourLightTheme,
                }),
            })
            .groupBy(tEvents.eventId)
            .orderBy(tEvents.eventStartTime, 'desc')
            .executeSelectMany();

        const filteredEvents = unfilteredEvents.filter(event => {
            return props.access.can('event.visible', {
                event: event.slug,
                team: kAnyTeam,
            });
        });

        for (const event of filteredEvents) {
            event.teams = event.teams.filter(t => !!t.name);
        }

        if (params.sort) {
            const field = params.sort.field;
            const direction = params.sort.direction;

            filteredEvents.sort((a, b) => {
                let comparison = 0;
                if (field === 'startTime')
                    comparison = a.startTime.localeCompare(b.startTime);
                else if (field === 'endTime')
                    comparison = a.endTime.localeCompare(b.endTime);
                else if (field === 'shortName')
                    comparison = a.shortName.localeCompare(b.shortName);

                return direction === 'asc' ? comparison : -comparison;
            });
        }

        return {
            rowCount: filteredEvents.length,
            rows: filteredEvents,
        };
    }
});

type EventRowModel = ExtractRowModel<typeof eventDataSource>;

/**
 * The <EventsPage> component displays an overview of the available events within the portal, even
 * the ones that are not shortlisted, and enables event administrators to create entirely new
 * events. Events cannot be removed through the portal, although they can be hidden.
 */
export default async function EventsPage() {
    const authenticationContext = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'event.visible',
            scope: {
                event: kAnyEvent,
                team: kAnyTeam,
            },
        },
    });

    const columns: Column<EventRowModel>[] = [
        {
            field: 'hidden',
            display: 'flex',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                component: EventStatusCell,
            },
        },
        {
            field: 'shortName',
            headerName: 'Name',
            sortable: true,
            flex: 2,

            template: 'text',
            templateProps: {
                href: '/admin/events/{slug}',
            },
        },
        {
            field: 'startTime',
            headerName: 'Begin',
            sortable: true,
            flex: 1,

            template: 'date',
        },
        {
            field: 'endTime',
            headerName: 'End',
            sortable: true,
            flex: 1,

            template: 'date',
        },
        {
            field: 'teams',
            display: 'flex',
            headerName: 'Teams',
            sortable: false,
            flex: 2,

            template: 'component',
            templateProps: {
                component: EventTeamsCell,
            },
        }
    ];

    const defaultValues = {
        startTime: Temporal.Now.zonedDateTimeISO('Europe/Amsterdam')
            .with({ hour: 14, minute: 0, second: 0 }).toString(),

        endTime: Temporal.Now.zonedDateTimeISO('Europe/Amsterdam')
            .with({ hour: 20, minute: 0, second: 0 }).add({ days: 3 }).toString(),
    };

    return (
        <TopLevelLayout>
            <Section title="Events">
                <DataTable columns={columns}
                           source={eventDataSource.authorize(authenticationContext)}
                           defaultSort={{ field: 'startTime', sort: 'desc' }} disableFooter
                           listViewProps={{
                               primaryField: 'shortName',
                               dateField: 'startTime',
                               linkTemplate: '/admin/events/{slug}',
                               startComponent: EventStatusCell,
                           }} />
            </Section>
            { authenticationContext.access.can('admin') &&
                <Section title="Create new event">
                    <SectionIntroduction important>
                        Events will remain hidden until they are published in their settings.
                    </SectionIntroduction>
                    <FormGrid action={createEvent} defaultValues={defaultValues}
                              callToAction="Create">
                        <EventSettingsForm mutableSlug />
                    </FormGrid>
                </Section> }
        </TopLevelLayout>
    );
}

export const metadata: Metadata = {
    title: 'Events | AnimeCon Volunteer Manager',
};
