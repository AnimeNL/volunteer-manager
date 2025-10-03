// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';

import { type Temporal, formatDate, isAfter, isBefore } from '@lib/Temporal';

/**
 * Number of days prior to the availability window closing that a warning should be shown.
 */
const kWindowCloseWarningDays = 14;

/**
 * Props accepted by the <AvailabilityWarning> component.
 */
interface AvailabilityWarningProps {
    /**
     * Current date and time on the server.
     */
    currentTime: Temporal.ZonedDateTime;

    /**
     * Status of the availability window for which we may be displaying a warning.
     */
    window?: {
        start?: Temporal.ZonedDateTime;
        end?: Temporal.ZonedDateTime;
    };
}

/**
 * The <AvailabilityWarning> component displays a warning regarding the availability of choice for
 * the given component. People with an override receive a warning, whereas everyone else receives
 * an error message in case the window has closed already.
 */
export function AvailabilityWarning(props: AvailabilityWarningProps) {
    const { currentTime, window } = props;

    if (!window || !window.start) {
        return (
            <Alert severity="warning">
                You aren't able to submit your preferences just yet. We haven't set a date for when
                this feature will open—stay tuned!
            </Alert>
        );
    }

    if (isBefore(currentTime, window.start)) {
        const windowOpenDate = formatDate(window.start, 'dddd, MMMM Do');

        return (
            <Alert severity="warning">
                You aren't able to submit your preferences just yet. Please come back after{' '}
                {windowOpenDate} for more information.
            </Alert>
        );
    }

    if (!!window.end) {
        const windowCloseDate = formatDate(window.end, 'dddd, MMMM Do');
        if (isAfter(currentTime, window.end)) {
            return (
                <Alert severity="error">
                    The window to submit your preferences closed on {windowCloseDate}. If you have
                    any questions or concerns, please send us an e-mail.
                </Alert>
            );
        }

        const daysUntilWindowCloseDate = currentTime.until(window.end, { largestUnit: 'days' });
        if (daysUntilWindowCloseDate.days <= kWindowCloseWarningDays) {
            return (
                <Alert severity="warning">
                    The window to submit your preferences will be closing on {windowCloseDate},
                    which is coming up very soon.
                </Alert>
            );
        }
    }

    return <></>;
}
