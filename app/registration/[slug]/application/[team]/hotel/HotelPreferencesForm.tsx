// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useState } from 'react';

import { SelectElement, TextFieldElement, useFormContext } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

import { CollapsableGrid } from '@components/CollapsableGrid';
import { LocalDatePickerElement } from '@components/LocalDatePickerElement';
import { Temporal, formatDate } from '@lib/Temporal';
import { dayjs } from '@lib/DateTime';

/**
 * Options users can choose from when indicating whether they would like a hotel room.
 */
const kInterestedOptions = [
    { id: 0, label: 'No, I don\'t need a hotel room' },
    { id: 1, label: 'Yes, I would like a hotel room' },
];

/**
 * How many days before and after the event can a hotel room be booked for?
 */
const kSelectableDaysAroundEvent = 5;

/**
 * Props accepted by the <HotelPreferencesForm> component.
 */
export interface HotelPreferencesFormProps {
    /**
     * Date on which the event will take place. When provided, this will limit the minimal and
     * maximal selectable dates within the picker. Will be provided in a `Temporal.ZonedDateTime`
     * compatible format in UTC.
     */
    eventDate: string;

    /**
     * Whether the form should be marked as read-only mode.
     */
    readOnly?: boolean;

    /**
     * Hotel rooms that are available for selection.
     */
    rooms: { id: number; label: string; }[];
}

/**
 * The <HotelPreferencesFormProps> component displays the actual form through which volunteers can
 * indicate their hotel room preferences.
 */
export function HotelPreferencesForm(props: HotelPreferencesFormProps) {
    const { readOnly, rooms } = props;

    const { watch } = useFormContext();

    const interested = watch('interested');

    const [ minDate, setMinDate ] = useState<dayjs.Dayjs | undefined>(undefined);
    const [ maxDate, setMaxDate ] = useState<dayjs.Dayjs | undefined>(undefined);

    useEffect(() => {
        const eventDateTemporal = Temporal.ZonedDateTime.from(props.eventDate);
        const eventDate = dayjs(formatDate(eventDateTemporal, 'YYYY-MM-DD[ 12:00:00]'));
        if (!eventDate.isValid())
            return;

        setMinDate(eventDate.subtract(kSelectableDaysAroundEvent, 'day'));
        setMaxDate(eventDate.add(kSelectableDaysAroundEvent, 'day'));

    }, [ props.eventDate ]);

    return (
        <>
            <Grid size={{ xs: 12 }}>
                <SelectElement name="interested" label="Would you like a hotel room?"
                               options={kInterestedOptions} fullWidth size="small" required
                               disabled={readOnly} />
            </Grid>

            <CollapsableGrid size={{ xs: 12 }} in={!!interested}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="hotelId" label="Which room would you like?"
                                       options={rooms} fullWidth size="small" required
                                       disabled={readOnly} />
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="sharingPeople" label="For how many people?"
                                          fullWidth size="small" required type="number"
                                          disabled={readOnly} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="sharingPreferences" label="Sharing preferences?"
                                          fullWidth size="small" required
                                          disabled={readOnly} />
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                        <LocalDatePickerElement name="checkIn" label="Check in" textReadOnly
                                                inputProps={{ fullWidth: true, size: 'small' }}
                                                minDate={minDate} maxDate={maxDate} required
                                                disabled={readOnly} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <LocalDatePickerElement name="checkOut" label="Check out" textReadOnly
                                                inputProps={{ fullWidth: true, size: 'small' }}
                                                minDate={minDate} maxDate={maxDate} required
                                                disabled={readOnly} />
                    </Grid>
                </Grid>
            </CollapsableGrid>
        </>
    );
}
