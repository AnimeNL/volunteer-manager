// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod';

import GroupsIcon from '@mui/icons-material/Groups';

import { BooleanCell, BooleanHeader } from '@app/admin/components/DataTable/cells/BooleanCell';
import { Cache } from '@lib/cache/Cache';
import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel, type Column,
    type ExtractRowModel } from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TeamNameCell } from './TeamCells';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getTeam } from '@lib/cache';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';
import db, { tContent, tEventsTeams, tTeams } from '@lib/database';

import { kContentType } from '@lib/database/Types';

/**
 * Data source for the team settings of an event.
 */
const eventTeamsDataSource = createDataSource('admin/event/settings/teams', withContext({
    /**
     * Event for which the team participation is being obtained.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the team.
     */
    id: z.number(),

    /**
     * Whether the team is participating in the event.
     */
    participating: z.boolean(),

    /**
     * Name of the team.
     */
    name: z.string(),

    /**
     * Target number of volunteers we hope will participate in the team.
     */
    targetSize: z.number().nullish(),

    /**
     * URL to the WhatsApp group to which they will be invited.
     */
    whatsappLink: z.string().nullish(),

    /**
     * Whether the team has been deleted for future participation. Deleted teams may still be shown
     * for historic accuracy.
     */
    hasTeamBeenDeleted: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event.slug,
            permission: {
                permission: 'event.settings',
                scope: {
                    event: context.event.slug,
                },
            },
        });
    },

    async list(params, props, context) {
        const eventsTeamsJoin = tEventsTeams.forUseInLeftJoin();

        const teams = await db.selectFrom(tTeams)
            .leftJoin(eventsTeamsJoin)
                .on(eventsTeamsJoin.eventId.equals(context.event.id))
                    .and(eventsTeamsJoin.teamId.equals(tTeams.teamId))
            .select({
                id: tTeams.teamId,
                name: tTeams.teamName,
                targetSize: eventsTeamsJoin.teamTargetSize,
                participating: eventsTeamsJoin.enableTeam.equals(/* true= */ 1),
                whatsappLink: eventsTeamsJoin.whatsappLink,
                hasTeamBeenDeleted: tTeams.teamDeleted.isNotNull(),
            })
            .orderBy('hasTeamBeenDeleted', 'asc')
                .orderBy(tTeams.teamName, 'asc')
            .executeSelectMany();

        const filteredTeams =
            teams.filter(team => team.participating || !team.hasTeamBeenDeleted)
                 .map(team => ({ ...team, participating: !!team.participating }));

        return {
            rowCount: filteredTeams.length,
            rows: filteredTeams,
        };
    },

    async update(updatedRow, previousRow, props, context) {
        const event = context.event;

        const team = await getTeam(updatedRow.id);
        if (!team)
            notFound();

        const dbInstance = db;
        const success = await dbInstance.transaction(async () => {
            const affectedRows = await dbInstance.insertInto(tEventsTeams)
                .set({
                    eventId: event.id,
                    teamId: updatedRow.id,
                    teamTargetSize: updatedRow.targetSize || /* default= */ 100,
                    enableTeam: updatedRow.participating ? 1 : 0,
                    whatsappLink: updatedRow.whatsappLink,
                })
                .onConflictDoUpdateSet({
                    teamTargetSize: updatedRow.targetSize || /* default= */ 100,
                    enableTeam: updatedRow.participating ? 1 : 0,
                    whatsappLink: updatedRow.whatsappLink,
                })
                .executeInsert();

            if (!!affectedRows && updatedRow.participating) {
                const pages = [
                    { contentPath: '', contentTitle: event.shortName },
                    { contentPath: 'application', contentTitle: 'Apply to join' },
                ];

                await dbInstance.insertInto(tContent)
                    .values(pages.map((pageProps) => ({
                        eventId: event.id,
                        teamId: updatedRow.id,
                        contentType: kContentType.Page,
                        content: 'No content has been written yet…',
                        contentProtected: 1,
                        revisionAuthorId: props.user.id,
                        revisionVisible: 1,
                        ...pageProps,
                    })))
                    .onConflictDoNothing()
                    .executeInsert();

                // Invalidate the event's content since new pages were created:
                Cache.getInstance('Content').delete({ eventId: event.id });
            }

            return !!affectedRows;
        });

        if (success) {
            LogBuilder.for('UpdateEventTeamParticipation')
                .withInitiatorUser(props.user)
                .record({
                    event: context.event.shortName,
                    team: team.name,
                });
        }

        return !!success;
    },
});

/**
 * Page through which the teams associated with a given event can be configured.
 */
export default async function EventSettingsTeamsPage(
    props: PageProps<'/admin/events/[event]/settings/teams'>)
{
    const params = await props.params;
    const { event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    const columns: Column<ExtractRowModel<typeof eventTeamsDataSource>>[] = [
        {
            field: 'participating',
            headerAlign: 'center',
            headerName: 'Participating',
            align: 'center',
            editable: true,
            sortable: false,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                component: BooleanCell,
                componentContext: {
                    field: 'participating',
                    tooltips: {
                        header: 'Participating team?',
                        falsyValue: 'Team does not participate',
                        truthyValue: 'Team participates',
                    },
                },
                headerComponent: BooleanHeader,
            },
        },
        {
            field: 'name',
            headerName: 'Team',
            editable: false,
            sortable: false,
            flex: 2,

            template: 'component',
            templateProps: {
                component: TeamNameCell,
            },
        },
        {
            field: 'targetSize',
            headerName: 'Target # volunteers',
            headerAlign: 'center',
            description: 'How many volunteers will we ideally recruit?',
            align: 'center',
            editable: true,
            sortable: false,
            type: 'number',
            flex: 1,
        },
        {
            field: 'whatsappLink',
            headerName: 'WhatsApp invite',
            description: 'WhatsApp group invite to share with the team',
            editable: true,
            sortable: false,
            type: 'string',
            flex: 2,
        },
    ];

    return (
        <>
            <Section icon={ <GroupsIcon color="primary" /> } title="Participating teams"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                        { label: 'Participating teams' },
                     ]}>
                <SectionIntroduction>
                    Settings regarding the teams that are participating in {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={eventTeamsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           disableFooter
                           listViewProps={{
                               primaryField: 'name',
                               secondaryTemplate: 'Volunteer target: {targetSize}',
                               startComponent: BooleanCell,
                               startComponentContext: { field: 'participating' },
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Participating teams', 'Settings', { event: 'event' });
