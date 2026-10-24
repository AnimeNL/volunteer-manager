// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import Typography from '@mui/material/Typography';

import { FormProvider } from '@components/FormProvider';
import { FormSubmitButton } from '@components/FormSubmitButton';
import { RefundForm } from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/RefundForm';
import { formatDate } from '@lib/Temporal';
import { generatePortalMetadataFn } from '../../../../generatePortalMetadataFn';
import { getApplicationContext } from '../getApplicationContext';
import { getStaticContent } from '@lib/Content';
import db, { tEvents, tUsersEventsPreferencesRefunds } from '@lib/database';

import { updateRefundPreferences }
    from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/PreferenceActions';

/**
 * The <EventApplicationRefundPage> component allows volunteers to request a refund for their ticket
 * after the event has finished. Availability of this page is time limited.
 */
export default async function EventApplicationRefundPage(
    props: PageProps<'/registration/[slug]/application/[team]/refund'>)
{
    const { event, team, user } = await getApplicationContext(props);

    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Determine whether the signed in user already has (requested) a refund.
    // ---------------------------------------------------------------------------------------------

    const request = await dbInstance.selectFrom(tUsersEventsPreferencesRefunds)
        .where(tUsersEventsPreferencesRefunds.userId.equals(user.id))
            .and(tUsersEventsPreferencesRefunds.eventId.equals(event.id))
            .and(tUsersEventsPreferencesRefunds.preferenceVersionIsLatest.equals(/* true= */ 1))
        .select({
            accountName: tUsersEventsPreferencesRefunds.refundAccountName,
            accountIban: tUsersEventsPreferencesRefunds.refundAccountIban,
            ticketNumber: tUsersEventsPreferencesRefunds.refundTicketNumber,
        })
        .executeSelectNoneOrOne();

    // TODO: Join the |request| with a decision or status update when that page has been redone.
    // TODO: Join the tRefunds.refundConfirmedBy user ID with a users table entry.

    // ---------------------------------------------------------------------------------------------
    // Determine the state of the refund mechanism within the defined availability window.
    // ---------------------------------------------------------------------------------------------

    let state: 'available' | 'requested' | 'too-early' | 'too-late' | 'unavailable';
    let content: undefined | {
        title: string;
        markdown: React.ReactNode;
    };

    const refundAvailability = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            refundRequestsStart: tEvents.refundRequestsStart,
            refundRequestsEnd: tEvents.refundRequestsEnd,
        })
        .executeSelectOne();

    const contentPath = [ 'registration', 'application' ];

    if (!refundAvailability.refundRequestsStart || !refundAvailability.refundRequestsEnd) {
        state = 'unavailable';
        content = await getStaticContent([ ...contentPath, 'refund-unavailable' ], {
            substitutions: {
                event: event.shortName,
                firstName: user.nameOrFirstName,
            },
        });
    } else {
        const { refundRequestsStart, refundRequestsEnd } = refundAvailability;

        const contentOptions = {
            substitutions: {
                event: event.shortName,
                firstName: user.nameOrFirstName,
                refundRequestsStart: formatDate(refundRequestsStart, 'dddd, MMMM D'),
                refundRequestsEnd: formatDate(refundRequestsEnd, 'dddd, MMMM D'),
            },
        };

        const now = Temporal.Now.zonedDateTimeISO('UTC');

        if (!!request) {
            state = 'requested';
            content = await getStaticContent([ ...contentPath, 'refund' ], contentOptions);
        } else if (Temporal.ZonedDateTime.compare(now, refundRequestsStart) < 0) {
            state = 'too-early';
            content = await getStaticContent([ ...contentPath, 'refund-early' ], contentOptions);
        } else if (Temporal.ZonedDateTime.compare(now, refundRequestsEnd) > 0) {
            state = 'too-late';
            content = await getStaticContent([ ...contentPath, 'refund-late' ], contentOptions);
        } else {
            state = 'available';
            content = await getStaticContent([ ...contentPath, 'refund' ], contentOptions);
        }
    }

    // ---------------------------------------------------------------------------------------------

    const action = updateRefundPreferences.bind(null, user.id, event.slug, team.slug);

    const readOnly = state !== 'available';

    return (
        <Box sx={{ p: 2 }}>
            {content?.markdown}

{ /*
            <Collapse in={!!request} unmountOnExit>
                <RefundConfirmation refund={request} />
            </Collapse>
   */ }

            { (!!request || state === 'available') &&
                <FormProvider action={action} defaultValues={request}>
                    <Box sx={{ mt: 1 }}>

                        <Typography variant="h5">
                            Request a ticket refund
                        </Typography>

                        { readOnly &&
                            <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
                                Great news! Your request has been received, so your preferences have
                                been locked in. Please e-mail us for any further changes!
                            </Alert> }

                        { !readOnly &&
                            <Typography sx={{ mt: 1, mb: 2 }}>
                                Your ticket number can be found in the confirmation e-mail you
                                received when you purchased it. Double check that the information
                                you enter is correct.
                            </Typography> }

                        <Grid container spacing={2}>
                            <RefundForm readOnly={readOnly} />
                        </Grid>

                    </Box>
                    { state === 'available' &&
                        <FormSubmitButton callToAction="Request a ticket refund"
                                          startIcon={ <MonetizationOnIcon /> } sx={{ mt: 2 }} /> }
                </FormProvider> }

            <Box sx={{ pt: 2 }}>
                <MuiLink component={Link}
                         href={`/registration/${event.slug}/application/${team.slug}`}>
                    « Back to your registration
                </MuiLink>
            </Box>

        </Box>
    );
}

export const generateMetadata = generatePortalMetadataFn('Ticket refunds');
