// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { useForm } from '@app/components/proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

import type { ServerAction } from '@lib/serverAction';
import { FormGrid } from '@app/admin/components/FormGrid';
import { Schedule, type ScheduleEvent, type ScheduleMarker, type ScheduleResource }
    from '@app/admin/components/Schedule';

/**
 * Colour assigned to each entry on the vendor schedule.
 */
const kScheduleColor = '#00796b';

/**
 * Title assigned to each entry on the vendor schedule.
 */
const kScheduleTitle = 'Work period';

/**
 * Interface that describes the information that the vendor's schedule should be populated with.
 * Contains information about both timing and appearance.
 */
interface VendorScheduleDisplayEntry {
    /**
     * Unique ID of the vendor for whom this entry exists.
     */
    id: number;

    /**
     * Full name of this vendor, as it should appear in the schedule.
     */
    name: string;

    /**
     * Role of the vendor.
     */
    role: string;

    /**
     * Scheduled shifts that exist for this vendor.
     */
    schedule: {
        /**
         * Unique ID of this scheduled entry.
         */
        id: number;

        /**
         * Time at which the shift begins.
         */
        start: string;

        /**
         * Time at which the shift ends.
         */
        end: string;

    }[];
}

/**
 * Props accepted by the <VendorSchedule> component.
 */
interface VendorScheduleProps {
    /**
     * Server Action through which the updated vendor scheme can be stored.
     */
    action: ServerAction;

    /**
     * The event for which the schedule is being displayed.
     */
    event: {
        /**
         * Date and time at which the event will commence, in a ZonedDateTime serialisation.
         */
        startTime: string;

        /**
         * Date and time at which the event will conclude, in a ZonedDateTime serialisation.
         */
        endTime: string;

        /**
         * Name of the timezone in which the shifts are being scheduled.
         */
        timezone: string;
    };

    /**
     * Whether the vendor schedule should be in read only mode.
     */
    readOnly?: boolean;

    /**
     * The roles, in order of them being displayed in the schedule.
     */
    roles: string[];

    /**
     * The schedule that has been assigned to this vendor team.
     */
    schedule: VendorScheduleDisplayEntry[];
}

/**
 * The <VendorSchedule> component displays a schedule for each of the vendors helping out in this
 * team during the selected event. The vendors are grouped by role.
 */
export function VendorSchedule(props: VendorScheduleProps) {
    const { event, readOnly, roles, schedule } = props;

    // ---------------------------------------------------------------------------------------------
    // Prepare the events and markers
    // ---------------------------------------------------------------------------------------------

    const [ events, setEvents ] = useState<ScheduleEvent[]>(
        schedule.map(vendor => vendor.schedule.map(schedule => ({
            id: schedule.id,
            start: Temporal.ZonedDateTime.from(schedule.start).toString({ timeZoneName: 'never' }),
            end: Temporal.ZonedDateTime.from(schedule.end).toString({ timeZoneName: 'never' }),
            title: kScheduleTitle,
            color: kScheduleColor,
            resource: vendor.id,
        }))).flat());

    const [ markers, resources ] = useMemo(() => {
        const markers: ScheduleMarker[] = [];
        const resources: ScheduleResource[] = [];

        // Step 1: Group the resources included in the `schedule`, and create a marker ahead of the
        // event's start time, which our calendar component gets wrong:
        const vendorsByRole: { [key: string]: ScheduleResource[] } = {};
        for (const vendor of schedule) {
            if (!Object.hasOwn(vendorsByRole, vendor.role))
                vendorsByRole[vendor.role] = [];

            markers.push({
                resource: vendor.id,
                background: '#f4f4f4',
                start: Temporal.ZonedDateTime.from(event.startTime)
                    .withTimeZone(event.timezone).with({ hour: 0, minute: 0, second: 0 })
                        .toString({ timeZoneName: 'never' }),
                end: Temporal.ZonedDateTime.from(event.startTime)
                    .withTimeZone(event.timezone).with({ hour: 4, minute: 30, second: 0 })
                        .toString({ timeZoneName: 'never' }),
            });

            vendorsByRole[vendor.role].push({
                id: vendor.id,
                name: vendor.name,
            });
        }

        // Step 2: Populate the `resources` in the order of the defined `roles`:
        for (const role of roles) {
            if (!Object.hasOwn(vendorsByRole, role))
                continue;  // not all roles are required for each event

            resources.push({
                id: `group/${role}`,
                name: role,
                eventCreation: false,
                children: vendorsByRole[role],
            });
        }

        return [ markers, resources ];

    }, [ event.startTime, event.timezone, roles, schedule ]);

    // ---------------------------------------------------------------------------------------------
    // Update when mutations are made
    // ---------------------------------------------------------------------------------------------

    const formContext = useForm();

    const handleChange = useCallback((events: ScheduleEvent[]) => {
        setEvents(events);

        // Trigger an invalidation in the form:
        formContext.setValue('_internal', 'none', { shouldDirty: true });

     }, [ formContext ]);

    const handleSubmit = useCallback(async () => {
        return props.action({
            resources: resources.map(
                group => group.children!.map(resource => resource.id as number)).flat(),
            schedule: events.map(event => ({
                id: typeof event.id === 'number' ? event.id : 0,
                vendorId: event.resource as number,
                start: event.start,
                end: event.end,
            })),
        });

    }, [ events, props.action, resources ]);

    // ---------------------------------------------------------------------------------------------

    const eventDefaults: Partial<ScheduleEvent> = {
        color: kScheduleColor,
        title: kScheduleTitle,
        dragBetweenResources: false,
    };

    const min = Temporal.ZonedDateTime.from(event.startTime)
        .withTimeZone(event.timezone).with({ hour: 1, minute: 30, second: 0 })
            .toString({ timeZoneName: 'never' });

    const max = Temporal.ZonedDateTime.from(event.endTime)
        .withTimeZone(event.timezone).with({ hour: 23, minute: 30, second: 0 })
            .toString({ timeZoneName: 'never' });

    return (
        <FormGrid action={handleSubmit} form={formContext}>
            <Grid size={{ xs: 12 }}>
                <Schedule min={min} max={max} displayTimezone={event.timezone}
                          resources={resources} eventDefaults={eventDefaults}
                          eventOverlap={false} events={events} markers={markers}
                          readOnly={readOnly} onChange={handleChange} subject="shift" />
            </Grid>
        </FormGrid>
    );
}
