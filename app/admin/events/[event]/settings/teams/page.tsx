// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod';

import GroupsIcon from '@mui/icons-material/Groups';

import { BooleanCell, BooleanHeader } from '@app/admin/components/DataTable/cells/BooleanCell';
import { Cache } from '@lib/cache/Cache';
import { DataTable, createDataSource, withContext, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TeamNameCell } from './TeamCells';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';
import db, { tContent, tEventsTeams, tTeams } from '@lib/database';

import { kContentType } from '@lib/database/Types';

/**
 * Data source for the team settings of an event.
 */
const eventTeamsDataSource = createDataSource('admin/event/settings/teams', withContext({
    event: z.string(),
}), withRowModel({
    id: z.number(),
    name: z.string(),
    targetSize: z.number().optional(),
    enableTeam: z.boolean().optional(),
    whatsappLink: z.string().optional(),
    hasTeamBeenDeleted: z.boolean().optional(),
}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event,
            permission: {
                permission: 'event.settings',
                scope: {
                    event: context.event,
                },
            },
        });
    },

    async list(params, props, context) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const eventsTeamsJoin = tEventsTeams.forUseInLeftJoin();

        const teams = await db.selectFrom(tTeams)
            .leftJoin(eventsTeamsJoin)
                .on(eventsTeamsJoin.eventId.equals(event.id))
                    .and(eventsTeamsJoin.teamId.equals(tTeams.teamId))
            .where(tTeams.teamName.containsInsensitiveIfValue(params.search))
            .select({
                id: tTeams.teamId,
                name: tTeams.teamName,
                targetSize: eventsTeamsJoin.teamTargetSize,
                enableTeam: eventsTeamsJoin.enableTeam.equals(/* true= */ 1),
                whatsappLink: eventsTeamsJoin.whatsappLink,
                hasTeamBeenDeleted: tTeams.teamDeleted.isNotNull(),
            })
            .orderBy('hasTeamBeenDeleted', 'asc')
                .orderBy(tTeams.teamName, 'asc')
            .executeSelectMany() as any;

        const filteredTeams = teams.filter((team: any) => team.enableTeam || !team.hasTeamBeenDeleted)
            .map((team: any) => ({
                id: team.id,
                name: team.name,
                targetSize: team.targetSize ?? undefined,
                enableTeam: !!team.enableTeam,
                whatsappLink: team.whatsappLink ?? undefined,
                hasTeamBeenDeleted: team.hasTeamBeenDeleted,
            }));

        return {
            rowCount: filteredTeams.length,
            rows: filteredTeams,
        };
    },

    async update(
        updatedRow: any, previousRow: any,
        props: any, context: any
    ): Promise<boolean> {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        const success = await dbInstance.transaction(async () => {
            const affectedRows = await dbInstance.insertInto(tEventsTeams)
                .set({
                    eventId: event.id,
                    teamId: updatedRow.id,
                    teamTargetSize: updatedRow.targetSize ?? 25,
                    enableTeam: updatedRow.enableTeam ? 1 : 0,
                    whatsappLink: updatedRow.whatsappLink,
                })
                .onConflictDoUpdateSet({
                    teamTargetSize: updatedRow.targetSize || undefined,
                    enableTeam: updatedRow.enableTeam ? 1 : 0,
                    whatsappLink: updatedRow.whatsappLink,
                })
                .executeInsert();

            if (!!affectedRows && updatedRow.enableTeam) {
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
            const teamName = await db.selectFrom(tTeams)
                .where(tTeams.teamId.equals(updatedRow.id))
                .selectOneColumn(tTeams.teamName)
                .executeSelectNoneOrOne();

            RecordLog({
                type: kLogType.AdminUpdateEvent,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                data: {
                    action: 'team settings',
                    event: event.shortName,
                    team: teamName,
                }
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
            field: 'enableTeam',
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
                    field: 'enableTeam',
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
                               startComponentContext: {
                                   field: 'enableTeam',
                                   tooltips: {
                                       header: 'Participating team?',
                                       falsyValue: 'Team does not participate',
                                       truthyValue: 'Team participates',
                                   },
                               },
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Participating teams', 'Settings', { event: 'event' });
