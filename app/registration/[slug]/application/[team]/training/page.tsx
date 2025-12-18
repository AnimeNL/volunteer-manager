// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { forbidden, notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AvailabilityWarning } from '../AvailabilityWarning';
import { FormProvider } from '@components/FormProvider';
import { FormSubmitButton } from '@components/FormSubmitButton';
import { Markdown } from '@components/Markdown';
import { Temporal, isAfter, isBefore } from '@lib/Temporal';
import { TrainingConfirmation } from './TrainingConfirmation';
import { TrainingPreferencesForm } from './TrainingPreferencesForm';
import { generatePortalMetadataFn } from '../../../../generatePortalMetadataFn';
import { getApplicationContext } from '../getApplicationContext';
import { getStaticContent } from '@lib/Content';
import { getTrainingOptions } from './getTrainingOptions';
import db, { tEvents, tRoles, tTrainings, tTrainingsAssignments, tUsersEvents } from '@lib/database';

import * as actions from '../../ApplicationActions';

/**
 * The <EventApplicationTrainingPage> component serves the ability for users to select which
 * training session they would like to participate in, if any. Not all volunteers are eligible
 * to participate in the trainings.
 */
export default async function EventApplicationTrainingPage(
    props: PageProps<'/registration/[slug]/application/[team]/training'>)
{
    const { access, event, team, user } = await getApplicationContext(props);

    const currentTime = Temporal.Now.zonedDateTimeISO('utc');
    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Fetch detailed information necessary to display this page, including settings in regards to
    // the training sessions that may be organised.
    // ---------------------------------------------------------------------------------------------

    const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();
    const trainingsJoin = tTrainings.forUseInLeftJoin();

    const data = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .leftJoin(trainingsAssignmentsJoin)
            .on(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
                .and(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
        .leftJoin(trainingsJoin)
            .on(trainingsJoin.trainingId.equals(trainingsAssignmentsJoin.assignmentTrainingId))
        .where(tUsersEvents.userId.equals(user.id))
            .and(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
        .select({
            assignment: {
                confirmed: trainingsAssignmentsJoin.assignmentConfirmed,
                trainingId: trainingsAssignmentsJoin.assignmentTrainingId,
                training: {
                    address: trainingsJoin.trainingAddress,
                    start: trainingsJoin.trainingStart,
                    end: trainingsJoin.trainingEnd,
                },
            },
            preferences: {
                submitted: trainingsAssignmentsJoin.assignmentId.isNotNull(),
                trainingId: trainingsAssignmentsJoin.preferenceTrainingId,
            },
            settings: {
                availability: {
                    start: tEvents.trainingPreferencesStart,
                    end: tEvents.trainingPreferencesEnd,
                },
                detailsPublished: tEvents.trainingInformationPublished,
                eligible: tUsersEvents.trainingEligible.valueWhenNull(tRoles.roleTrainingEligible),
                enabled: tEvents.hotelEnabled,
                timezone: tEvents.eventTimezone,
            },
        })
        .executeSelectNoneOrOne();

    if (!data || !data.settings.enabled)
        notFound();

    const { assignment, preferences, settings } = data;

    // ---------------------------------------------------------------------------------------------
    // Decide whether the volunteer has the ability to access the training preferences page, and
    // whether the page should be shown in read-only mode versus being fully editable.
    // ---------------------------------------------------------------------------------------------

    let locked: boolean = !!assignment?.confirmed;

    if (!access.can('event.trainings', { event: event.slug })) {
        if (!settings.detailsPublished || !settings.availability?.start)
            forbidden();  // details have not been published yet, but do tease existence

        if (isBefore(currentTime, settings.availability.start))
            forbidden();  // the availability window has not opened yet

        if (!!settings.availability.end && isAfter(currentTime, settings.availability.end))
            locked = true;  // the availability window has closed
    }

    // ---------------------------------------------------------------------------------------------

    const content = await getStaticContent([ 'registration', 'application', 'training' ], {
        firstName: user.nameOrFirstName,
    });

    const defaultValues = {
        training: preferences?.trainingId ??
            (preferences?.submitted ? /* skip the training= */ 0 : undefined),
    };

    const action = actions.updateTrainingPreferences.bind(null, event.id, team.id);
    const sessions = await getTrainingOptions(event.id);

    // ---------------------------------------------------------------------------------------------

    return (
        <Stack spacing={2} sx={{ p: 2 }}>

            { !settings.detailsPublished &&
                <Alert severity="warning">
                    Details about the available training sessions have not been published yet, which
                    may result in this page appearing incomplete or broken.
                </Alert> }

            { !assignment?.confirmed &&
                <AvailabilityWarning currentTime={currentTime} window={settings.availability} /> }

            { !!content && <Markdown>{content.markdown}</Markdown> }

            { !!assignment?.confirmed &&
                <TrainingConfirmation timezone={settings.timezone}
                                      training={assignment.training}/> }

            { (!!settings.eligible || !!preferences?.trainingId) &&
                <>
                    <Typography variant="h5">
                        Your training preferences
                    </Typography>

                    { !!locked &&
                        <Alert severity="warning" sx={{ mt: '8px !important' }}>
                            { !assignment?.trainingId &&
                                'You\'re confirmed to skip this year\'s training ' }
                            { !!assignment?.trainingId && 'Your participation has been confirmed ' }
                            so your preferences are now locked in. If you have any questions, just
                            send us an email!
                        </Alert> }

                    <FormProvider action={action} defaultValues={defaultValues}>
                        <TrainingPreferencesForm sessions={sessions} readOnly={locked} />
                        { !locked &&
                            <FormSubmitButton callToAction="Update my preferences" sx={{ mt: 2 }}
                                              startIcon={ <HistoryEduIcon /> } /> }
                    </FormProvider>
                </> }

            <MuiLink component={Link} href={`/registration/${event.slug}/application/${team.slug}`}>
                « Back to your registration
            </MuiLink>

        </Stack>
    );
}

export const generateMetadata = generatePortalMetadataFn('Training preferences');
