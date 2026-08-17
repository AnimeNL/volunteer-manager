// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { FormProvider } from '@components/FormProvider';
import { FormSubmitButton } from '@components/FormSubmitButton';
import { ParticipationForm } from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/ParticipationForm';
import { generatePortalMetadataFn } from '../../../../generatePortalMetadataFn';
import { getApplicationContext } from '../getApplicationContext';
import { getStaticContent } from '@lib/Content';
import db, { tUsersEventsPreferencesParticipation } from '@lib/database';

import { updateParticipationPreferences }
    from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/PreferenceActions';

/**
 * Page that allows volunteers to manage their participation preferences.
 */
export default async function EventApplicationParticipationPage(
    props: PageProps<'/registration/[slug]/application/[team]/participation'>)
{
    const { event, team, user } = await getApplicationContext(props);

    const defaultValues = await db.selectFrom(tUsersEventsPreferencesParticipation)
        .where(tUsersEventsPreferencesParticipation.userId.equals(user.id))
            .and(tUsersEventsPreferencesParticipation.eventId.equals(event.id))
            .and(tUsersEventsPreferencesParticipation.preferenceVersionIsLatest.equals(1))
        .select({
            includeCreditReel:
                tUsersEventsPreferencesParticipation.participationIncludeCreditReel,
            includeSocialMedia: tUsersEventsPreferencesParticipation.participationIncludeSocialMedia,
            tshirtFit: tUsersEventsPreferencesParticipation.participationTshirtFit,
            tshirtSize: tUsersEventsPreferencesParticipation.participationTshirtSize,
        })
        .executeSelectNoneOrOne();

    const content = await getStaticContent([ 'registration', 'application', 'participation' ], {
        substitutions: {
            firstName: user.nameOrFirstName,
        },
    });

    const updateFn = updateParticipationPreferences.bind(null, user.id, event.slug, team.slug);

    return (
        <FormProvider action={updateFn} defaultValues={defaultValues}>
            <Stack spacing={2} sx={{ p: 2 }}>
                {content?.markdown}

                <Grid container spacing={2}>
                    <ParticipationForm />
                </Grid>

                <FormSubmitButton />

                <MuiLink component={Link} href={`/registration/${event.slug}/application`}>
                    « Back to your registration
                </MuiLink>

            </Stack>
        </FormProvider>
    );
}

export const generateMetadata = generatePortalMetadataFn('Your participation');
