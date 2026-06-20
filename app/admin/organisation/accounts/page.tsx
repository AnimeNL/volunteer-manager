// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import { SelectElement, TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import PersonIcon from '@mui/icons-material/Person';
import Typography from '@mui/material/Typography';

import { type Column, type ExtractRowModel,DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tUsers } from '@lib/database';

import * as actions from './[id]/AccountActions';

import { kGenderOptions } from '@app/registration/authentication/RegisterForm';

/**
 * Data source through which the Accounts data table can be populated.
 */
const accountsDataSource = createDataSource('admin/organisation/accounts', withRowModel({
    /**
     * Unique ID assigned to this user upon their registration.
     */
    id: z.number(),

    /**
     * Full name of the account holder, or their display name when one has been set.
     */
    name: z.string().optional(),

    /**
     * E-mail address associated with the account, if any.
     */
    email: z.string().optional(),

    /**
     * Phone number associated with the account, if any.
     */
    phoneNumber: z.string().optional(),

    /**
     * Discord handle associated with the account, if any.
     */
    discord: z.string().optional(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'organisation.accounts',
                operation: 'read',
            },
        });
    },

    async list(params) {
        const dbInstance = db;

        const pagedVolunteers = await dbInstance.selectFrom(tUsers)
            .where(tUsers.anonymized.isNull())
                .and(tUsers.name.containsIfValue(params.search).or(
                    tUsers.username.containsIfValue(params.search).or(
                    tUsers.phoneNumber.containsIfValue(params.search).or(
                    tUsers.discordHandle.containsIfValue(params.search)))))
            .select({
                id: tUsers.userId,
                name: tUsers.name,
                email: tUsers.username,
                phoneNumber: tUsers.phoneNumber,
                discord: tUsers.discordHandle,
            })
            .orderBy(params.sort.field as any, params.sort.direction)  // todo
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: pagedVolunteers.count,
            rows: pagedVolunteers.data,
        };
    }
});

/**
 * The <AccountsPage> component lists the accounts known to the Volunteer Manager. Each account can
 * be viewed and adjusted providing the right permissions are available to the signed in user.
 */
export default async function AccountsPage() {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'organisation.accounts',
            operation: 'read',
        },
    });

    const canCreateAccounts = access.can('organisation.accounts', 'create');
    const columns: Column<ExtractRowModel<typeof accountsDataSource>>[] = [
        {
            field: 'name',
            flex: 1.5,

            headerName: 'Name',

            template: 'text',
            templateProps: {
                href: '/admin/organisation/accounts/{id}',
            },
        },
        {
            field: 'email',
            flex: 1,

            headerName: 'E-mail',
        },
        {
            field: 'phoneNumber',
            flex: 1,

            headerName: 'Phone number',
        },
        {
            field: 'discord',
            flex: 1,

            headerName: 'Discord',
        },
        // TODO: Teams
    ];

    return (
        <Section icon={ <PersonIcon color="primary" /> } title="Accounts" breadcrumbs={[
            { label: 'Organisation', href: '/admin/organisation' },
            { label: 'Accounts' },
        ]}>
            <SectionIntroduction>
                This table lists all volunteers who helped us out since 2010. Note that our
                accounts are separate from any that exist in AnPlan.
            </SectionIntroduction>
            <DataTable columns={columns} source={accountsDataSource} search="prominent"
                       defaultSort={{ field: 'name', sort: 'asc' }} listViewProps={{
                           primaryField: 'name',
                           linkTemplate: '/admin/organisation/accounts/{id}',
                       }} />
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
