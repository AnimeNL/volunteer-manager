// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import DeleteIcon from '@mui/icons-material/Delete';
import Grid from '@mui/material/Grid';

import { FormGrid } from '@app/admin/components/FormGrid';
import { SectionClearAction } from '@app/admin/components/SectionClearAction';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { ViewingHistoryTable } from './ViewingHistoryTable';
import { VisibilityToggle } from './VisibilityToggle';
import { formatDate } from '@lib/Temporal';
import { generateEventMetadataFn } from '../../../generateEventMetadataFn';
import { readSetting } from '@lib/Settings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tDutyBook, tDutyBookViewers, tEvents, tUsers } from '@lib/database';

import * as actions from '../DutyBookActions';

/**
 * The Duty Book is the place where volunteers log information about incidents that happens during
 * the festival, so that others are aware of the specifics and/or the associated pictures.
 */
export default async function EventTeamDutyBookIncidentPage(
    props: PageProps<'/admin/events/[event]/[team]/duty-book/[id]'>)
{
    const { access, event, team } = await verifyAccessAndFetchPageInfo(props.params);

    const dutyBookEnabled = await readSetting('schedule-duty-book');
    if (!dutyBookEnabled || !team.flagEnableDutyBook)
        notFound();

    const dbInstance = db;

    const incidentId = (await props.params).id;
    const incident = await dbInstance.selectFrom(tDutyBook)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tDutyBook.dutyBookEventId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tDutyBook.dutyBookUserId))
        .where(tDutyBook.dutyBookId.equals(parseInt(incidentId, /* radix= */ 10)))
            .and(tDutyBook.dutyBookDeleted.isNull())
        .select({
            id: tDutyBook.dutyBookId,
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
            formatDate(incident.defaultValues.created.withTimeZone(event.timezone),
                       'YYYY-MM-DD HH:mm:ss') as any;
    }

    if (incident.defaultValues.hidden) {
        incident.defaultValues.hidden =
            formatDate(incident.defaultValues.hidden.withTimeZone(event.timezone),
                       'YYYY-MM-DD HH:mm:ss') as any;
    }

    const viewers = await dbInstance.selectFrom(tDutyBookViewers)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tDutyBookViewers.dutyBookViewerUserId))
        .where(tDutyBookViewers.dutyBookId.equals(incident.id))
        .select({
            id: tUsers.userId,
            date: dbInstance.dateTimeAsString(tDutyBookViewers.dutyBookViewerDate),
            name: tUsers.name,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    const visibilityToggleServerFn = actions.updateVisibility.bind(null, event.id, incident.id);

    return (
        <>
            <Section title="Duty book incident" subtitle={event.shortName}
                     headerAction={
                         <SectionClearAction
                            action={ actions.deleteIncident.bind(null, event.id, incident.id )}
                            icon={ <DeleteIcon color="error" fontSize="small" /> }
                            subject="incident"
                            title="Remove this incident"
                            verb="remove" />
                     }>
                <VisibilityToggle
                    hidden={incident.hidden}
                    toggleFn={visibilityToggleServerFn} />
                <FormGrid action={ actions.updateDetails.bind(null, event.id, incident.id) }
                          defaultValues={incident.defaultValues}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextFieldElement name="author" label="Author" size="small" fullWidth
                                          disabled/>
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
                        <TextFieldElement name="summary" label="Summary" size="small" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="incident" label="Incident" size="small" fullWidth
                                          multiline />
                    </Grid>
                </FormGrid>
            </Section>
            <Section title="Incident viewing history" subtitle={`${viewers.length}`}>
                <SectionIntroduction>
                    We record the first time a volunteer reads a Duty Book entry to understand the
                    effectiveness of the book for spreading awareness.
                </SectionIntroduction>
                <ViewingHistoryTable
                    enableAccountLinks={ access.can('organisation.accounts', 'read') }
                    viewers={viewers} />
            </Section>
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Duty book incident');
