// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Typography from '@mui/material/Typography';

import { ConfirmationBox } from '../hotel/ConfirmationBox';
import { type Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <TrainingConfirmation> component.
 */
interface TrainingConfirmationProps {
    /**
     * Timezone in which the event will be taking place.
     */
    timezone: string;

    /**
     * Information about the volunteer's training participation that we're representing.
     */
    training?: {
        address?: string;
        start: Temporal.ZonedDateTime;
        end: Temporal.ZonedDateTime;
    };
}

/**
 * The <TrainingConfirmation> component displays confirmation of a training session being assigned,
 * or that the volunteer does not have to participate in the training.
 */
export function TrainingConfirmation(props: TrainingConfirmationProps) {
    const { timezone, training } = props;

    if (!training) {
        return (
            <>
                <Typography variant="h5">
                    Your confirmed participation
                </Typography>
                <ConfirmationBox primary="You'll skip the professional training this year"
                                 secondary="We look forward to seeing you at the event instead!" />
            </>
        );
    }

    const localStartTime = training.start.withTimeZone(timezone);
    const localEndTime = training.end.withTimeZone(timezone);

    const date = formatDate(localStartTime, 'dddd, MMMM D');

    const startTime = formatDate(localStartTime, 'H:mm');
    const endTime = formatDate(localEndTime, 'H:mm');

    return (
        <>
            <Typography variant="h5">
                Your confirmed participation
            </Typography>
            <ConfirmationBox
                primary={`You'll be joining the training on ${date}`}
                secondary={training.address}
                tertiary={`Please be there at ${startTime}, we'll finish around ${endTime}`} />
        </>
    );
}
