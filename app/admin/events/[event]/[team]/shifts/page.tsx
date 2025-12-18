// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { forbidden, notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import CategoryIcon from '@mui/icons-material/Category';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';

import { CollapsableSection } from '@app/admin/components/CollapsableSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShiftCreateSection } from './ShiftCreateSection';
import { ShiftTable } from './ShiftTable';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { getShiftMetadata } from './getShiftMetadata';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The shifts page allows leadership to define the individual tasks and work items that can be
 * assigned to our volunteers. Shifts linked to program entries will automatically warn when they
 * end up out of sync.
 */
export default async function EventTeamShiftsPage(
    props: PageProps<'/admin/events/[event]/[team]/shifts'>)
{
    const { access, event, team } = await verifyAccessAndFetchPageInfo(props.params);

    const accessScope = { event: event.slug, team: team.slug };

    const canCreateShifts = access.can('event.shifts', 'create', accessScope);
    const canReadShifts = access.can('event.shifts', 'read', accessScope);
    const canUpdateShifts = access.can('event.shifts', 'update', accessScope);
    const canDeleteShifts = access.can('event.shifts', 'delete', accessScope);

    if (!canReadShifts)
        forbidden();

    if (!team.flagEnableScheduling)
        notFound();

    const { activities, categories, locations } = await getShiftMetadata(event.festivalId);

    let headerAction: React.ReactNode;
    if (access.can('event.shift-categories')) {
        headerAction = (
            <Tooltip title="Shift categories">
                <IconButton LinkComponent={Link} href="./shifts/categories" size="small">
                    <CategoryIcon color="primary" fontSize="small" />
                </IconButton>
            </Tooltip>
        );
    }

    // TODO: Box with warnings regarding the shifts (e.g. out-of-sync entries).
    const warnings: any[] = [ ];

    return (
        <>
            { (!canCreateShifts && !canUpdateShifts && !canDeleteShifts) &&
                <Paper component={Alert} severity="warning">
                    Please ask your Staff member to add you to the scheduling team if you would like
                    to be able to make any changes.
                </Paper> }
            <Section title="Shifts" headerAction={headerAction} subtitle={team.name}>
                <ShiftTable event={event.slug} team={team.slug} canDeleteShifts={canDeleteShifts} />
            </Section>
            <CollapsableSection in={!!warnings.length} title="Shift warnings">
                <SectionIntroduction important>
                    The shifts tool has not been implemented yet.
                </SectionIntroduction>
            </CollapsableSection>
            { canCreateShifts &&
                <Section title="Create a new shift" permission="event.shifts">
                    <ShiftCreateSection activities={activities} categories={categories}
                                        locations={locations} event={event.slug} team={team.slug} />
                </Section> }
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Shifts');
