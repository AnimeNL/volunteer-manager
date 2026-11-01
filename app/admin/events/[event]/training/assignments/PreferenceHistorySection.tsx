// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import HistoryIcon from '@mui/icons-material/History';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { formatDate } from '@lib/Temporal';
import { readUserSetting } from '@lib/UserSettings';
import db, { tTeams, tTrainings, tUsers, tUsersEvents, tUsersEventsPreferencesTraining }
    from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Data source for recent changes to training preferences made by volunteers.
 */
const historyDataSource = createDataSource('admin/event/training/assignments/history', withContext({
    /**
     * Event for which training preference history is being retrieved.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of this preference version entry.
     */
    id: z.string(),

    /**
     * Unique ID of the volunteer who made the change.
     */
    userId: z.number(),

    /**
     * Name of the volunteer who made the change.
     */
    name: z.string(),

    /**
     * Team slug of the volunteer, used to linkify their entry.
     */
    team: z.string(),

    /**
     * Formatted label of the preferred training session, or "Skip the training".
     */
    training: z.string(),

    /**
     * Date and time (ISO 8601) at which the preference was recorded.
     */
    updated: z.string(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.trainings',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        const trainingsJoin = tTrainings.forUseInLeftJoin();

        const dbInstance = db;
        const preferences = await dbInstance.selectFrom(tUsersEventsPreferencesTraining)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEventsPreferencesTraining.userId))
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.eventId.equals(tUsersEventsPreferencesTraining.eventId))
                    .and(tUsersEvents.userId.equals(tUsersEventsPreferencesTraining.userId))
                    .and(tUsersEvents.registrationStatus.in([
                        kRegistrationStatus.Accepted,
                        kRegistrationStatus.Cancelled,
                    ]))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .leftJoin(trainingsJoin)
                .on(trainingsJoin.trainingId.equals(tUsersEventsPreferencesTraining.trainingId))
            .where(tUsersEventsPreferencesTraining.eventId.equals(context.event.id))
                .and(tUsers.name.containsInsensitiveIfValue(params.search))
            .select({
                userId: tUsersEventsPreferencesTraining.userId,
                name: tUsers.name,
                team: tTeams.teamSlug,
                trainingId: tUsersEventsPreferencesTraining.trainingId,
                trainingStart: trainingsJoin.trainingStart,
                updated: dbInstance.dateTimeAsString(
                    tUsersEventsPreferencesTraining.preferenceVersion),
            })
            .groupBy(
                tUsersEventsPreferencesTraining.userId,
                tUsersEventsPreferencesTraining.preferenceVersion)
            .orderBy('updated', 'desc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: preferences.count,
            rows: preferences.data.map(preference => {
                let training = 'Skip the training';
                if (preference.trainingId) {
                    training = preference.trainingStart
                        ? formatDate(
                              preference.trainingStart.withTimeZone(context.event.timeZone),
                              'dddd, MMMM D')
                        : 'Unknown session';
                }

                return {
                    id: `${preference.userId}-${preference.updated}`,
                    userId: preference.userId,
                    name: preference.name,
                    team: preference.team,
                    training,
                    updated: preference.updated,
                };
            }),
        };
    },
});

/**
 * Props accepted by the <PreferenceHistorySection> component.
 */
interface PreferenceHistorySectionProps {
    /**
     * Unique slug of the event for which training preference history should be displayed.
     */
    event: string;

    /**
     * Unique ID of the signed-in user, to persist the section's expanded state.
     */
    userId: number;
}

/**
 * The <PreferenceHistorySection> component displays recent changes made by volunteers to their
 * training participation preferences.
 */
export async function PreferenceHistorySection(props: PreferenceHistorySectionProps) {
    const defaultExpanded =
        await readUserSetting(props.userId, 'user-admin-training-expand-history') ?? false;

    const linkTemplate =
        `/admin/events/${props.event}/{team}/volunteers/{userId}/preferences/training`;

    const columns: Column<ExtractRowModel<typeof historyDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Volunteer',
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                href: linkTemplate,
            },
        },
        {
            field: 'training',
            headerName: 'Training session',
            sortable: false,
            flex: 3,

            template: 'text',
        },
        {
            field: 'updated',
            headerName: 'Updated',
            sortable: false,
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
    ];

    return (
        <ExpandableSection defaultExpanded={defaultExpanded} icon={ <HistoryIcon /> }
                           setting="user-admin-training-expand-history" title="Preference history">
            <DataTable columns={columns} source={historyDataSource}
                       context={{ event: props.event }}
                       defaultSort={{ field: 'updated', sort: 'desc' }}
                       disableQueryParams pageSize={5} subject="preference change"
                       listViewProps={{
                           primaryField: 'name',
                           secondaryField: 'training',
                           dateField: 'updated',
                           dateFieldFormat: 'YYYY-MM-DD',
                           linkTemplate,
                       }} />
        </ExpandableSection>
    );
}
