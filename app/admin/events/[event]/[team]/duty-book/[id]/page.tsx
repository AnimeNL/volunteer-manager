// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import DeleteIcon from '@mui/icons-material/Delete';
import Grid from '@mui/material/Grid';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';

import { DataTable, createDataSource, kEventTransformer, kTeamTransformer, withContext,
    withRowModel, type Column, type ExtractRowModel } from '@app/admin/components/DataTable';

import { FormGrid } from '@app/admin/components/FormGrid';
import { SectionClearAction } from '@app/admin/components/SectionClearAction';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { VisibilityToggle } from './VisibilityToggle';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { formatDate } from '@lib/Temporal';
import { requireAuthenticationContextWithEventAndTeam } from '../../../requireAuthenticationContextWithEventAndTeam';
import db, { tDutyBook, tDutyBookViewers, tEvents, tUsers } from '@lib/database';

import * as actions from '../DutyBookActions';


/**
 * Data source through which the viewing history of an incident can be retrieved.
 */
const viewingHistoryDataSource = createDataSource('event/team/duty-book/viewers', withContext({
    /**
     * Unique ID of the incident to display the viewing history for.
     */
    incidentId: z.number(),

    /**
     * Event that the Duty Book is in scope for.
     */
    event: kEventTransformer,

    /**
     * Team that the Duty Book is in scope for.
     */
    team: kTeamTransformer,

}), withRowModel({
    /**
     * Unique ID of the row (user ID).
     */
    id: z.number(),

    /**
     * Date at which the incident was read.
     */
    date: z.string(),

    /**
     * The user who read the incident.
     */
    user: z.object({
        id: z.number(),
        name: z.string(),
    }),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'event.duty-book',
                operation: 'read',
                scope: {
                    event: context.event.slug,
                    team: context.event.slug,
                },
            },
        });
    },

    async list(params, props, context) {
        const dbInstance = db;
        const results = await dbInstance.selectFrom(tDutyBookViewers)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tDutyBookViewers.dutyBookViewerUserId))
            .where(tDutyBookViewers.dutyBookId.equals(context.incidentId))
                .and(tUsers.name.containsInsensitiveIfValue(params.search))
            .select({
                id: tUsers.userId,
                date: dbInstance.dateTimeAsString(tDutyBookViewers.dutyBookViewerDate),
                user: {
                    id: tUsers.userId,
                    name: tUsers.name,
                },
            })
            .orderBy(params.sort.field === 'user' ? 'user.name' : 'date', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: results.count,
            rows: results.data,
        };
    },
});

/**
 * The Duty Book is the place where volunteers log information about incidents that happens during
 * the festival, so that others are aware of the specifics and/or the associated pictures.
 */
export default async function EventTeamDutyBookIncidentPage(
    props: PageProps<'/admin/events/[event]/[team]/duty-book/[id]'>)
{
    const params = await props.params;

    const { access, event, team } = await requireAuthenticationContextWithEventAndTeam(props, {
        permission: 'event.duty-book',
        operation: 'read',
        scope: {
            event: params.event,
            team: params.team,
        },
    });

    if (!team.flags.enableDutyBook)
        notFound();

    const dbInstance = db;
    const incident = await dbInstance.selectFrom(tDutyBook)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tDutyBook.dutyBookEventId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tDutyBook.dutyBookUserId))
        .where(tDutyBook.dutyBookId.equals(parseInt(params.id, /* radix= */ 10)))
            .and(tDutyBook.dutyBookDeleted.isNull())
        .select({
            id: tDutyBook.dutyBookId,
            authorFirstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            defaultValues: {
                author: tUsers.name,
                event: tEvents.eventShortName,
                created: tDutyBook.dutyBookCreated,
                hidden: tDutyBook.dutyBookHidden,
                summary: tDutyBook.dutyBookAiSummary,
                incident: tDutyBook.dutyBookIncident,
            },
            hidden: tDutyBook.dutyBookHidden.isNotNull(),
        })
        .executeSelectNoneOrOne();

    if (!incident)
        notFound();

    if (incident.defaultValues.created) {
        incident.defaultValues.created =
            formatDate(incident.defaultValues.created.withTimeZone(event.timeZone),
                       'YYYY-MM-DD HH:mm:ss') as any;
    }

    if (incident.defaultValues.hidden) {
        incident.defaultValues.hidden =
            formatDate(incident.defaultValues.hidden.withTimeZone(event.timeZone),
                       'YYYY-MM-DD HH:mm:ss') as any;
    }

    const viewersCount = await dbInstance.selectFrom(tDutyBookViewers)
        .where(tDutyBookViewers.dutyBookId.equals(incident.id))
        .selectOneColumn(dbInstance.count(tDutyBookViewers.dutyBookViewerUserId))
        .executeSelectOne();

    // ---------------------------------------------------------------------------------------------

    const deleteIncidentFn = actions.deleteIncident.bind(null, event.slug, team.slug, incident.id);
    const updateDetailsFn = actions.updateDetails.bind(null, event.slug, team.slug, incident.id);
    const visibilityToggleFn =
        actions.updateVisibility.bind(null, event.slug, team.slug, incident.id);

    let sectionClearAction: React.ReactNode = undefined;
    if (access.can('event.duty-book', 'delete', { event: event.slug, team: team.slug })) {
        sectionClearAction = (
            <SectionClearAction action={deleteIncidentFn}
                                icon={ <DeleteIcon color="error" fontSize="small" /> }
                                subject="incident"
                                title="Remove this incident"
                                verb="remove" />
        );
    }

    // ---------------------------------------------------------------------------------------------

    const canUpdate = access.can('event.duty-book', 'update', {
        event: event.slug,
        team: team.slug
    });

    // ---------------------------------------------------------------------------------------------

    const columns: Column<ExtractRowModel<typeof viewingHistoryDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Viewed on',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
        {
            field: 'user',
            headerName: 'Viewed by',
            flex: 1,

            template: 'account',
        }
    ];

    return (
        <>
            <Section icon={ <OutlinedFlagIcon color="primary" /> }
                     title={`Incident #${params.id}`} headerAction={sectionClearAction}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.name, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                            label: 'Duty book',
                            href: `/admin/events/${event.slug}/${team.slug}/duty-book`
                         },
                         { label: `Incident #${params.id}` },
                     ]}>
                <SectionIntroduction>
                    An incident reported by {incident.authorFirstName} during {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <VisibilityToggle
                    hidden={incident.hidden}
                    toggleFn={visibilityToggleFn} />
                <FormGrid action={updateDetailsFn} defaultValues={incident.defaultValues}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextFieldElement name="author" label="Author" size="small" fullWidth
                                          disabled />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextFieldElement name="event" label="Event" size="small" fullWidth
                                          disabled />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextFieldElement name="created" label="Created on…" size="small" fullWidth
                                          disabled />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextFieldElement name="hidden" label="Hidden on…" size="small" fullWidth
                                          disabled />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="summary" label="Summary" size="small" fullWidth
                                          slotProps={{ input: { readOnly: !canUpdate } }} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="incident" label="Incident" size="small" fullWidth
                                          multiline
                                          slotProps={{ input: { readOnly: !canUpdate } }} />
                    </Grid>
                </FormGrid>
            </Section>
            <Section title="Viewing history" subtitle={`${viewersCount}`}>
                <DataTable
                    columns={columns}
                    source={viewingHistoryDataSource}
                    context={{ incidentId: incident.id, event: event.slug, team: team.slug }}
                    defaultSort={{ field: 'user', sort: 'asc' }}
                    pageSize={100}
                    disableSearch
                    listViewProps={{
                        primaryField: 'user.name',
                        dateField: 'date',
                        dateFieldFormat: 'YYYY-MM-DD HH:mm:ss',
                    }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'Incident #' }, 'Duty book', { team: 'team' },
                             { event: 'event' });
