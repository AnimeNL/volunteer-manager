// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SelectElement, TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import PersonIcon from '@mui/icons-material/Person';
import Typography from '@mui/material/Typography';

import { AccountDataTable } from './AccountDataTable';
import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '../../components/Section';
import { SectionIntroduction } from '../../components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getBlobUrl } from '@lib/database/BlobStore';
import { readUserSettings } from '@lib/UserSettings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tStorage, tTeams, tUsers, tUsersEvents } from '@lib/database';

import * as actions from './[id]/AccountActions';
import { kGenderOptions } from '@app/registration/authentication/RegisterForm';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * The <AccountsPage> component lists the accounts known to the Volunteer Manager. Each account can
 * be viewed and adjusted providing the right permissions are available to the signed in user.
 */
export default async function AccountsPage() {
    const { access, user } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'organisation.accounts',
            operation: 'read',
        },
    });

    const canCreateAccounts = access.can('organisation.accounts', 'create');

    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Volunteer information from the database:
    // ---------------------------------------------------------------------------------------------

    const storageJoin = tStorage.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const volunteers = await dbInstance.selectFrom(tUsers)
            .leftJoin(usersEventsJoin)
                .on(usersEventsJoin.userId.equals(tUsers.userId)
                    .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted)))
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
            .leftJoin(storageJoin)
                .on(storageJoin.fileId.equals(tUsers.avatarId))
            .where(tUsers.anonymized.isNull())
            .select({
                id: tUsers.userId,
                username: tUsers.username,
                firstName: tUsers.firstName,
                lastName: tUsers.lastName,
                displayName: tUsers.displayName,
                avatar: storageJoin.fileHash,
                name: tUsers.name,
                gender: tUsers.gender,
                phoneNumber: tUsers.phoneNumber,
                discordHandle: tUsers.discordHandle,
                birthdate: dbInstance.dateAsString(tUsers.birthdate),
                teams: dbInstance.stringConcatDistinct(teamsJoin.teamName),
                activated: tUsers.activated.equals(/* true= */ 1),
                suspended: tUsers.participationSuspended.isNotNull(),
            })
            .groupBy(tUsers.userId)
            .orderBy(tUsers.name, 'asc')
            .executeSelectMany();

    for (let index = 0; index < volunteers.length; ++index)
        volunteers[index].avatar = getBlobUrl(volunteers[index].avatar);

    // ---------------------------------------------------------------------------------------------
    // Team information from the database:
    // ---------------------------------------------------------------------------------------------

    const teams = await dbInstance.selectFrom(tTeams)
        .select({
            name: tTeams.teamName,
            themeColor: tTeams.teamColourLightTheme,
        })
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------
    // Column and filter preferences:
    // ---------------------------------------------------------------------------------------------

    const userSettings = await readUserSettings(user.id, [
        'user-admin-volunteers-columns-hidden',
        'user-admin-volunteers-columns-filter',
    ]);

    const filterModel = userSettings['user-admin-volunteers-columns-filter'] || undefined;
    const hiddenFields =
        userSettings['user-admin-volunteers-columns-hidden']
            || 'firstName,lastName,displayName,phoneNumber,gender,birthdate,discordHandle';

    return (
        <Section icon={ <PersonIcon color="primary" /> } title="Accounts">
            <SectionIntroduction>
                This table lists all volunteers who helped us out since 2010—not all information
                is complete, and these accounts are separate from the information stored in AnPlan.
            </SectionIntroduction>
            <AccountDataTable initialFilterModel={filterModel}
                              initialHiddenFields={hiddenFields}
                              teams={teams}
                              volunteers={volunteers} />
            { canCreateAccounts &&
                <>
                    <Divider />
                    <FormGrid action={actions.createAccount} callToAction="Create">
                        <Grid size={{ xs: 12 }} sx={{ my: -1 }}>
                            <Typography variant="h6">
                                Create a new account
                            </Typography>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="username" label="E-mail address" size="small"
                                              fullWidth required type="email" />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SelectElement name="gender" label="Gender" size="small" fullWidth
                                           options={kGenderOptions} />
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="firstName" label="First name" size="small"
                                              fullWidth required />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="lastName" label="Last name" size="small"
                                              fullWidth required />
                        </Grid>
                    </FormGrid>
                </> }
        </Section>
    );
}

export const generateMetadata = createGenerateMetadataFn('Accounts', 'Organisation');
