// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import TabletIcon from '@mui/icons-material/Tablet';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DisplayColorCell, DisplayHelpRequestStatusCell, DisplayIdentifierCell, DisplayLabelCell,
    DisplayLastCheckInCell, DisplayLockedCell, DisplayLockedHeader } from './DisplayCells';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { readSetting } from '@lib/Settings';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tActivitiesLocations, tDisplays, tEvents } from '@lib/database';

import { type DisplayHelpRequestStatus, kDisplayHelpRequestStatus } from '@lib/database/Types';

/**
 * Data source through which the physical displays can be retrieved, configured, and deleted.
 */
const displaysDataSource = createDataSource('admin/organisation/displays', withRowModel({
    /**
     * Unique ID of the display as it exists in the database.
     */
    id: z.number(),

    /**
     * Unique identifier associated with this display. Generated at random.
     */
    identifier: z.string(),

    /**
     * Human-associated label identifying what the display is being used for.
     */
    label: z.string().optional(),

    /**
     * Unique ID of the event the display should be associated with.
     */
    eventId: z.number().optional(),

    /**
     * Short name of the event the display is associated with.
     */
    event: z.string().optional(),

    /**
     * Unique ID of the location the display should be associated with.
     */
    locationId: z.number().optional(),

    /**
     * Display name of the location the display is associated with.
     */
    location: z.string().optional(),

    /**
     * Colour (in HEX) that the display's light bar should be shown in.
     */
    color: z.string().regex(/^#[A-Fa-f0-9]{6}$/).or(z.literal('')).optional(),

    /**
     * The help request status this display is in, if any.
     */
    helpRequestStatus: z.enum(kDisplayHelpRequestStatus).or(z.literal(' ')).optional(),

    /**
     * Last check-in performed by the device. (Temporal ZDT-compatible format.)
     */
    lastCheckIn: z.string(),

    /**
     * IP address using which the last check-in was performed.
     */
    lastCheckInIp: z.string(),

    /**
     * Whether the device is locked.
     */
    locked: z.boolean(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, 'organisation.displays');
    },

    async delete(row, props) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tDisplays)
            .set({
                displayDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tDisplays.displayId.equals(row.id))
                .and(tDisplays.displayDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('DeleteDisplay')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                identifier: row.identifier,
                label: row.label || 'Unprovisioned',
            });

        return !!affectedRows;
    },

    async list(params) {
        const maximumDaysSinceCheckIn =
            await readSetting('display-max-time-since-check-in-days') ?? 14;

        const currentDateTime = Temporal.Now.zonedDateTimeISO('utc');
        const minimumDateTime = currentDateTime.subtract({ days: maximumDaysSinceCheckIn });

        const eventsJoin = tEvents.forUseInLeftJoin();
        const locationsJoin = tActivitiesLocations.forUseInLeftJoin();

        const dbInstance = db;
        const displays = await dbInstance.selectFrom(tDisplays)
            .leftJoin(eventsJoin)
                .on(eventsJoin.eventId.equals(tDisplays.displayEventId))
            .leftJoin(locationsJoin)
                .on(locationsJoin.locationId.equals(tDisplays.displayLocationId))
            .select({
                id: tDisplays.displayId,
                identifier: tDisplays.displayIdentifier,
                label: tDisplays.displayLabel,
                eventId: tDisplays.displayEventId,
                event: eventsJoin.eventShortName,
                locationId: tDisplays.displayLocationId,
                location: locationsJoin.locationDisplayName.valueWhenNull(
                    locationsJoin.locationName),
                color: tDisplays.displayColor,
                helpRequestStatus: tDisplays.displayHelpRequestStatus,
                lastCheckIn: dbInstance.dateTimeAsString(tDisplays.displayCheckIn),
                lastCheckInIp: tDisplays.displayCheckInIp,
                locked: tDisplays.displayLocked.equals(/* true= */ 1),
            })
            .where(tDisplays.displayDeleted.isNull())
                .and(tDisplays.displayCheckIn.greaterThan(minimumDateTime))
                .and(
                    tDisplays.displayLabel.containsInsensitiveIfValue(params.search).or(
                    tDisplays.displayIdentifier.containsInsensitiveIfValue(params.search).or(
                    eventsJoin.eventShortName.containsInsensitiveIfValue(params.search)
                )))
            .executeSelectPage();

        return {
            rowCount: displays.count,
            rows: displays.data,
        };
    },

    async update(row, previousRow, props) {
        let displayHelpRequestStatus: DisplayHelpRequestStatus | null = null;
        if (!!row.helpRequestStatus && row.helpRequestStatus !== ' ')
            displayHelpRequestStatus = row.helpRequestStatus;

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tDisplays)
            .set({
                displayLabel: row.label ?? null,
                displayEventId: !!row.eventId ? row.eventId : null,
                displayLocationId: !!row.locationId ? row.locationId : null,
                displayColor: !!row.color ? row.color : null,
                displayHelpRequestStatus,
                displayLocked: !!row.locked ? 1 : 0,
            })
            .where(tDisplays.displayId.equals(row.id))
                .and(tDisplays.displayDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateDisplay')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Info')
            .record({
                identifier: row.identifier,
                label: row.label || 'Unprovisioned',
            });

        return !!affectedRows;
    },
});

/**
 * The <DisplaysPage> component hosts a data table that shows the physical displays that have
 * recently checked in, and allows them to be provisioned and configured.
 */
export default async function DisplaysPage() {
    await requireAuthentication('organisation.displays');

    const dbInstance = db;
    const events = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventFestivalId.isNotNull())
        .select({
            value: tEvents.eventId,
            label: tEvents.eventShortName,
        })
        .orderBy(tEvents.eventStartTime, 'desc')
        .executeSelectMany();

    const locations = await dbInstance.selectFrom(tActivitiesLocations)
        .innerJoin(tEvents)
            .on(tEvents.eventFestivalId.equals(tActivitiesLocations.locationFestivalId))
        .where(tActivitiesLocations.locationDeleted.isNull())
        .select({
            value: tActivitiesLocations.locationId,
            label: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),

            // Used for filtering the available locations:
            eventId: tEvents.eventId,
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const columns: Column<ExtractRowModel<typeof displaysDataSource>>[] = [
        {
            field: 'identifier',
            headerName: 'Identifier',
            flex: 1,
            sortable: false,

            template: 'component',
            templateProps: {
                component: DisplayIdentifierCell,
            },
        },
        {
            field: 'label',
            headerName: 'Label',
            editable: true,
            flex: 2,
            sortable: false,

            editorProps: {
                placeholder: 'Display label',
                required: true,
            },

            template: 'component',
            templateProps: {
                component: DisplayLabelCell,
            },
        },
        {
            field: 'eventId',
            headerName: 'Event',
            editable: true,
            flex: 1,
            sortable: false,

            type: 'singleSelect',
            valueOptions: [ { value: 0, label: ' ' }, ...events ],

            template: 'text',
            templateProps: {
                field: 'event',
            },
        },
        {
            field: 'locationId',
            headerName: 'Location',
            editable: true,
            flex: 1,
            sortable: false,

            type: 'singleSelect',
            valueOptions: [
                { value: 0, label: ' ' },
                ...locations.map(l => ({ value: l.value, label: l.label })),
            ],

            template: 'text',
            templateProps: {
                field: 'location',
                defaultValue: '…',
            },
        },
        {
            field: 'color',
            headerName: 'Fixed color',
            description: '#RRGGBB',
            editable: true,
            flex: 1,
            sortable: false,

            editorProps: {
                placeholder: '#RRGGBB',
            },

            template: 'component',
            templateProps: {
                component: DisplayColorCell,
            },
        },
        {
            field: 'helpRequestStatus',
            headerName: 'Help request',
            editable: true,
            flex: 1,
            sortable: false,

            type: 'singleSelect',
            valueOptions: [ ' ', ...Object.values(kDisplayHelpRequestStatus) ],

            template: 'component',
            templateProps: {
                component: DisplayHelpRequestStatusCell,
            },
        },
        {
            field: 'lastCheckIn',
            headerName: 'Last check-in',
            flex: 1,
            sortable: false,

            template: 'component',
            templateProps: {
                component: DisplayLastCheckInCell,
            },
        },
        {
            field: 'locked',
            headerName: '',
            description: 'Is the device locked?',
            editable: true,
            align: 'center',
            headerAlign: 'center',
            width: 50,
            sortable: false,
            type: 'boolean',

            template: 'component',
            templateProps: {
                headerComponent: DisplayLockedHeader,
                component: DisplayLockedCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <TabletIcon color="primary" /> }
                     title="Displays"
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Displays' },
                     ]}>
                <SectionIntroduction>
                    Manage the physical displays that we distribute during the festival to help
                    busy areas self-manage their volunteers.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable
                    columns={columns}
                    defaultSort={{ field: 'id', sort: 'asc' }}
                    pageSize={25}
                    refreshOnMutation
                    source={displaysDataSource}
                    subject="display"
                    listViewProps={{
                        primaryField: 'identifier',
                        secondaryTemplate: '{label}',
                        dateField: 'lastCheckIn',
                        dateFieldFormat: 'YYYY-MM-DD HH:mm:ss',
                        startComponent: DisplayLockedCell,
                    }}
                />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Displays', 'Organisation');
