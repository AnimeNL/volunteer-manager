// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SelectElement, TextFieldElement } from '@components/proxy/react-hook-form-mui';

import DomainAddIcon from '@mui/icons-material/DomainAdd';
import DomainDisabledIcon from '@mui/icons-material/DomainDisabled';
import EuroIcon from '@mui/icons-material/Euro';
import Grid from '@mui/material/Grid';
import GroupsIcon from '@mui/icons-material/Groups';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import ReceiptIcon from '@mui/icons-material/Receipt';
import Stack from '@mui/material/Stack';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { DiscordIcon } from '../../dashboard/DiscordIcon';
import { ExportTile } from './ExportTile';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents, tTeams } from '@lib/database';

import { kExportType } from '@lib/database/Types';

import * as actions from '../ExportsActions';

/**
 * Options that can be selected for the availability of the export.
 */
const kAvailabilityOptions = [
    { id: 1, label: '1 hour' },
    { id: 8, label: '8 hours' },
    { id: 24, label: '1 day' },
    { id: 24 * 7, label: '1 week' },
    { id: 24 * 7 * 2, label: '2 weeks' },
];

/**
 * Options that can be selected for the maximum number of views of an export.
 */
const kViewsOptions = [
    { id: 1, label: '1 view' },
    { id: 5, label: '5 views' },
    { id: 10, label: '10 views' },
    { id: 25, label: '25 views' },
    { id: 50, label: '50 views' },
];

/**
 * The <OrganisationExportsCreatePage> component is the first step in the ability to create a new
 * data export. It provides easy access to a series of targetted export pages.
 */
export default async function OrganisationExportsCreatePage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.exports'
    });

    const events = await db.selectFrom(tEvents)
        .where(tEvents.eventHidden.equals(/* false= */ 0))
        .select({
            id: tEvents.eventId,
            label: tEvents.eventShortName,
        })
        .orderBy(tEvents.eventStartTime, 'desc')
        .executeSelectMany();

    const teams = await db.selectFrom(tTeams)
        .where(tTeams.teamDeleted.isNull())
        .select({
            id: tTeams.teamId,
            label: tTeams.teamName,
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const exportBuildUpFn = actions.createSimpleExport.bind(null, kExportType.BuildUp);
    const exportCreditReelConsentFn = actions.createSimpleExport.bind(null, kExportType.Credits);
    const exportDiscordHandlesFn = actions.createSimpleExport.bind(null, kExportType.Discord);
    const exportRefundRequestsFn = actions.createSimpleExport.bind(null, kExportType.Refunds);
    const exportTearDownFn = actions.createSimpleExport.bind(null, kExportType.TearDown);
    const exportTrainingsFn = actions.createSimpleExport.bind(null, kExportType.Trainings);
    const exportVolunteersFn = actions.createSimpleExport.bind(null, kExportType.Volunteers);
    const exportWhatsappFn = actions.createSimpleExport.bind(null, kExportType.WhatsApp);

    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap"
                       useFlexGap>
                    <ExportTile action={exportBuildUpFn}
                                icon={ <DomainAddIcon color="primary" /> }
                                label="Build-up volunteers">
                        <CommonExportForm events={events} teams={teams} />
                    </ExportTile>

                    <ExportTile action={exportCreditReelConsentFn}
                                icon={ <ReceiptIcon color="primary" /> }
                                label="Credit reel consent">
                        <CommonExportForm events={events} teams={teams} />
                    </ExportTile>

                    <ExportTile action={exportDiscordHandlesFn}
                                icon={ <DiscordIcon color="primary" /> }
                                label="Discord handles">
                        <CommonExportForm events={events} teams={teams} />
                    </ExportTile>

                    <ExportTile action={exportRefundRequestsFn}
                                icon={ <EuroIcon color="primary" /> }
                                label="Refund requests">
                        <CommonExportForm events={events} />
                    </ExportTile>

                    <ExportTile action={exportTearDownFn}
                                icon={ <DomainDisabledIcon color="primary" /> }
                                label="Tear-down volunteers">
                        <CommonExportForm events={events} teams={teams} />
                    </ExportTile>

                    <ExportTile action={exportTrainingsFn}
                                icon={ <HistoryEduIcon color="primary" /> }
                                label="Training participation">
                        <CommonExportForm events={events} />
                    </ExportTile>

                    <ExportTile action={exportVolunteersFn}
                                icon={ <GroupsIcon color="primary" /> }
                                label="Volunteer lists">
                        <CommonExportForm events={events} teams={teams} />
                    </ExportTile>

                    <ExportTile action={exportWhatsappFn}
                                icon={ <WhatsAppIcon color="primary" /> }
                                label="WhatsApp numbers">
                        <CommonExportForm events={events} teams={teams} />
                    </ExportTile>
                </Stack>
            </Grid>
        </Grid>
    );
}

/**
 * Props accepted by the <CommonExportForm> component.
 */
interface CommonExportFormProps {
    /**
     * Events that can be selected for a data export.
     */
    events: { id: number; label: string; }[];

    /**
     * Teams that can be selected for a data export. Optional field.
     */
    teams?: { id: number; label: string; }[];
}

/**
 * Common form fields that need to be included in the export form. Represented by the
 * `kCreateSimpleExportData` type in the action definition.
 */
function CommonExportForm(props: CommonExportFormProps) {
    return (
        <>
            <Grid size={{ xs: 12, sm: !!props.teams ? 6 : 12 }}>
                <SelectElement name="event" label="Event" required fullWidth
                               size="small" options={props.events} />
            </Grid>
            { !!props.teams &&
                <Grid size={{ xs: 12, sm: 6 }}>
                    <SelectElement name="team" label="Team (optional)" fullWidth
                                   size="small" options={props.teams} />
                </Grid> }

            <Grid size={{ xs: 12, sm: 6 }}>
                <SelectElement name="availability" label="Time limit" required fullWidth
                               size="small" options={kAvailabilityOptions} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
                <SelectElement name="views" label="Access limit" required fullWidth
                               size="small" options={kViewsOptions} />
            </Grid>

            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="justification" label="Justification" required fullWidth
                                  size="small" />
            </Grid>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Exports', 'Organisation');
