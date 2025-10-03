// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import HistoryIcon from '@mui/icons-material/History';
import Paper from '@mui/material/Paper';

import type { NextPageParams } from '@lib/NextRouterParams';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { ScheduleContextImpl } from './ScheduleContext';
import { ScheduleHistoryTable } from './ScheduleHistoryTable';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { readUserSettings } from '@lib/UserSettings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { ScheduleImpl } from './ScheduleImpl';

/**
 * Data validation type for user-specific section expand settings.
 */
const kExpandSection = z.record(z.string(), z.boolean());

/**
 * The Schedule page enables leads to build the comprehensive schedules defining where volunteers
 * will be helping out throughout the event. This is one of the most complex pages in our app, which
 * relies on the timeline component as well as data from many different sources.
 */
export default async function EventTeamSchedulePage(props: NextPageParams<'event' | 'team'>) {
    const { access, event, team, user } = await verifyAccessAndFetchPageInfo(props.params);
    if (!access.can('event.schedule.planning', 'read', { event: event.slug, team: team.slug }))
        notFound();

    if (!team.flagEnableScheduling)
        notFound();

    const userSettings = await readUserSettings(user.id, [
        'user-admin-schedule-date',
        'user-admin-schedule-expand-sections',
        'user-admin-schedule-expand-history',
        'user-admin-schedule-expand-warnings',
        'user-admin-schedule-highlight-shifts',
        'user-admin-schedule-inclusive-shifts',
    ]);

    const defaultContext = {
        date: userSettings['user-admin-schedule-date'],
        highlightedShifts: userSettings['user-admin-schedule-highlight-shifts'],
        inclusiveShifts: userSettings['user-admin-schedule-inclusive-shifts'] ?? false,
    };

    const readOnly =
        !access.can('event.schedule.planning', 'update', { event: event.slug, team: team.slug });

    let sections: z.infer<typeof kExpandSection> = {};
    try {
        const unverifiedSections =
            JSON.parse(userSettings['user-admin-schedule-expand-sections'] ?? '{}');

        // Only populate the `settings` when it's both valid JSON, and validates per
        // `kExpandSection`. This avoid type violations in runtime.
        sections = kExpandSection.parse(unverifiedSections);

    } catch (error: any) {
        console.warn(`User ${user.id} has invalid section expand configuration`, error);
    }

    // ---------------------------------------------------------------------------------------------

    const enableHistoryDelete = access.can('system.logs', 'delete');
    const enableHistoryProfileLinks = access.can('organisation.accounts', 'read');

    return (
        <>
            { !!readOnly &&
                <Paper component={Alert} severity="warning">
                    Please ask your Staff member to add you to the scheduling team if you would like
                    to be able to make any changes.
                </Paper> }
            <ScheduleContextImpl event={event} team={team} defaultContext={defaultContext}>

                <ScheduleImpl readOnly={readOnly} sections={sections}
                              historyContext={{ event: event.slug, team: team.slug }}
                              enableHistoryDelete={enableHistoryDelete}
                              enableHistoryProfileLinks={enableHistoryProfileLinks} />

                <ExpandableSection
                    defaultExpanded={ !!userSettings['user-admin-schedule-expand-history'] }
                    title="Recent changes" icon={ <HistoryIcon color="info" /> }
                    setting="user-admin-schedule-expand-history">

                    <ScheduleHistoryTable
                        context={{ event: event.slug, team: team.slug }}
                        enableDelete={enableHistoryDelete}
                        enableProfileLinks={enableHistoryProfileLinks} />

                </ExpandableSection>

                { /* TODO: Add a section displaying warnings */ }

            </ScheduleContextImpl>
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Schedule');
