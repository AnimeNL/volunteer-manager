// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import React from 'react';

import { AutocompleteElement } from '@components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { ApplicationAvailabilityForm } from '../../ApplicationParticipation';

/**
 * Function used to generate the ordinal belonging to a particular number.
 * @see https://stackoverflow.com/a/39466341
 */
const ordinal = (n: number) => [ 'st', 'nd', 'rd' ][ ((n + 90) % 100 - 10) % 10 - 1 ] || 'th';

/**
 * Props accepted by the <AvailabilityPreferencesForm> component.
 */
interface AvailabilityPreferencesFormProps {
    /**
     * Date at which the event will start, in a Temporal-compatible serialisation.
     */
    eventStartDate: string;

    /**
     * Date at which the event will end, in a Temporal-compatible serialisation.
     */
    eventEndDate: string;

    /**
     * Maximum number of events that this volunteer is able to indicate they want to attend.
     */
    exceptionEventLimit: number;

    /**
     * Events that the volunteer can indicate that they want to attend.
     */
    exceptionEvents?: { id: number; label: string }[];

    /**
     * Whether the option should be available where a volunteer can indicate that they're helping
     * out during the festival's build-up.
     */
    includeBuildUp?: boolean;

    /**
     * Whether the option should be available where a volunteer can indicate that they're helping
     * out during the festival's tear-down.
     */
    includeTearDown?: boolean;

    /**
     * Whether the form should be marked as read-only, useful in case their preferences have been
     * locked in ahead of scheduling.
     */
    readOnly?: boolean;
}

/**
 * The <AvailabilityPreferencesForm> component displays the form through which volunteers can
 * indicate their preferences regarding when they'll be around to help out.
 */
export function AvailabilityPreferencesForm(props: AvailabilityPreferencesFormProps) {
    const { readOnly } = props;

    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
                <Typography variant="h5">
                    What are your preferences?
                </Typography>
            </Grid>

            { readOnly &&
                <Grid size={{ xs: 12 }} sx={{ mt: -1 }}>
                    <Alert severity="warning">
                        We've started drafting your schedule, and your preferences have been locked
                        in. Please e-mail us for any further changes!
                    </Alert>
                </Grid> }

            <ApplicationAvailabilityForm eventStartDate={props.eventStartDate}
                                         eventEndDate={props.eventEndDate}
                                         includeBuildUp={props.includeBuildUp}
                                         includeDietaryRestrictions
                                         includeTearDown={props.includeTearDown} />

            { (!!props.exceptionEvents && props.exceptionEventLimit > 0) &&
                <>
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="h5">
                            Events that you plan to attend?
                        </Typography>
                    </Grid>
                    { [ ...Array(props.exceptionEventLimit) ].map((_, index) =>
                        <React.Fragment key={index}>
                            <Grid size={{ xs: 12, sm: 4, md: 3, lg: 2  }} alignSelf="center">
                                {index + 1}{ordinal(index + 1)} preference
                            </Grid>
                            <Grid size={{ xs: 12, sm: 8, md: 9, lg: 10 }}>
                                <AutocompleteElement name={`exceptionEvents[${index}]`}
                                                     autocompleteProps={{
                                                         disabled: !!props.readOnly,
                                                         fullWidth: true,
                                                         size: 'small',
                                                     }}
                                                     label="Event…"
                                                     options={props.exceptionEvents!} matchId />
                            </Grid>
                        </React.Fragment> )}

                </> }

        </Grid>
    );
}
