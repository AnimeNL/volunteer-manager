// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { AutocompleteElement, SelectElement, TextareaAutosizeElement, TextFieldElement }
    from '@components/proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import GroupsIcon from '@mui/icons-material/Groups';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';

import type { FlagProps } from './Flag';
import { AutocompleteElementWithDisabledOptions } from '@app/admin/components/AutocompleteElementWithDisabledOptions';
import { ColorInput } from '@app/admin/components/ColorInput';
import { Flag } from './Flag';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TeamQuickActions } from './TeamQuickActions';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tEnvironments, tRoles, tTeams, tTeamsRoles } from '@lib/database';

import * as actions from '../TeamsActions';

/**
 * The <TeamPage> component shows to the volunteer information about one very specific team, as has
 * been indicated in the URL's parameters. The team's settings can be updated from here too.
 */
export default async function TeamPage(props: PageProps<'/admin/organisation/structure/[slug]'>) {
    const { access } = await requireAuthentication({
        permission: 'organisation.teams',
        operation: 'read',
    });

    const canDisableTeam = access.can('organisation.teams', 'delete');
    const canUpdateTeam = access.can('organisation.teams', 'update');

    const teamsRolesDefaultJoin = tTeamsRoles.forUseInLeftJoinAs('trdj');
    const teamsRolesJoin = tTeamsRoles.forUseInLeftJoinAs('trj');

    const dbInstance = db;

    const params = await props.params;
    const team = await dbInstance.selectFrom(tTeams)
        .leftJoin(teamsRolesJoin)
            .on(teamsRolesJoin.teamId.equals(tTeams.teamId))
        .leftJoin(teamsRolesDefaultJoin)
            .on(teamsRolesDefaultJoin.teamId.equals(tTeams.teamId))
                .and(teamsRolesDefaultJoin.roleDefault.equals(/* true= */ 1))
        .where(tTeams.teamSlug.equals(params.slug))
        .select({
            id: tTeams.teamId,
            colorDarkMode: tTeams.teamColourDarkTheme,
            colorLightMode: tTeams.teamColourLightTheme,
            department: tTeams.teamDepartment,
            description: tTeams.teamDescription,
            environment: tTeams.teamEnvironmentId,
            name: tTeams.teamName,
            plural: tTeams.teamPlural,
            slug: tTeams.teamSlug,
            title: tTeams.teamTitle,
            emailAccountId: tTeams.teamEmailAccountId,

            defaultRoleId: teamsRolesDefaultJoin.roleId,
            availableRoleIds: dbInstance.aggregateAsArrayOfOneColumn(teamsRolesJoin.roleId),

            flagEnableDutyBook: tTeams.teamFlagEnableDutyBook.equals(/* true= */ 1),
            flagEnableScheduling: tTeams.teamFlagEnableScheduling.equals(/* true= */ 1),
            flagGrowthCharts: tTeams.teamFlagGrowthCharts.equals(/* true= */ 1),
            flagManagesContent: tTeams.teamFlagManagesContent.equals(/* true= */ 1),
            flagManagesFaq: tTeams.teamFlagManagesFaq.equals(/* true= */ 1),
            flagManagesFirstAid: tTeams.teamFlagManagesFirstAid.equals(/* true= */ 1),
            flagManagesSecurity: tTeams.teamFlagManagesSecurity.equals(/* true= */ 1),
            flagProgramRequests: tTeams.teamFlagProgramRequests.equals(/* true= */ 1),
            flagRequestConfirmation: tTeams.teamFlagRequestConfirmation.equals(/* true= */ 1),

            enabled: tTeams.teamDeleted.isNull(),
        })
        .executeSelectNoneOrOne();

    if (!team)
        notFound();

    // ---------------------------------------------------------------------------------------------

    const emailAccounts = await dbInstance.selectFrom(tEmailAccounts)
        .where(tEmailAccounts.emailAccountDeleted.isNull())
        .select({
            id: tEmailAccounts.emailAccountId,
            label: tEmailAccounts.emailAccountAddress,
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const roles = await dbInstance.selectFrom(tRoles)
        .select({
            id: tRoles.roleId,
            label: tRoles.roleName,
            disabled: tRoles.roleFlagDefaultRestricted.equals(/* true= */ 1),
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const environments = await dbInstance.selectFrom(tEnvironments)
        .where(tEnvironments.environmentDeleted.isNull())
            .and(tEnvironments.environmentDeleted.isNull())
        .select({
            id: tEnvironments.environmentId,
            label: tEnvironments.environmentTitle
                .concat(' (')
                .concat(tEnvironments.environmentDomain)
                .concat(')'),
        })
        .orderBy(tEnvironments.environmentTitle, 'asc')
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------
    // Determine the flags available for this team. Each flag must be fetched from the database, and
    // will be shown as a list item with a checkbox that can be appropriately toggled.
    // ---------------------------------------------------------------------------------------------

    const kFlags: FlagProps[] = [
        {
            field: 'flagEnableDutyBook',
            title: 'Enable access to the Duty Book',
        },
        {
            field: 'flagEnableScheduling',
            title: 'Enable volunteer scheduling tools',
        },
        {
            field: 'flagProgramRequests',
            title: 'Handles incoming program requests',
            description: 'Displays this team on the program help request overview',
        },
        {
            field: 'flagManagesContent',
            title: 'Manages landing page content',
            description: '',
        },
        {
            field: 'flagManagesFirstAid',
            title: 'Manages the First Aid team',
            description: '',
        },
        {
            field: 'flagManagesFaq',
            title: 'Manages the Knowledge Base',
            description: '',
        },
        {
            field: 'flagManagesSecurity',
            title: 'Manages the Security team',
            description: '',
        },
        {
            field: 'flagGrowthCharts',
            title: 'Participates in volunteer growth charts',
            description: 'Consider this team for the graphs shown under recent applications',
        },
        {
            field: 'flagRequestConfirmation',
            title: 'Request for confirmation in the application approve message?',
            description: 'Asks the volunteer to confirm receipt of the e-mail message',
        }
    ];

    // ---------------------------------------------------------------------------------------------

    const readOnly = !canUpdateTeam;

    const disableTeamFn = (canDisableTeam && !!team.enabled)
        ? actions.toggleTeamEnabled.bind(null, team.id, /* enabled= */ false)
        : undefined;

    const enableTeamFn = (canDisableTeam && !team.enabled)
        ? actions.toggleTeamEnabled.bind(null, team.id, /* enabled= */ true)
        : undefined;

    const resetTeamKeyFn = canUpdateTeam
        ? actions.resetTeamKey.bind(null, team.id)
        : undefined;

    const updateTeamFn = actions.updateTeam.bind(null, team.id);

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Section icon={ <GroupsIcon color="primary" /> } title={team.title}
                     limited={!canDisableTeam || !canUpdateTeam} breadcrumbs={[
                { label: 'Organisation', href: '/admin/organisation' },
                { label: 'Structure', href: '/admin/organisation/structure' },
                { label: team.title },
            ]}>
                <SectionIntroduction>
                    This page allows you to configure the settings for the{' '}
                    <strong>{team.title}</strong>.
                </SectionIntroduction>
            </Section>

            <FormGridSection noHeader tabs back="Back to teams"
                             action={updateTeamFn} defaultValues={team}>
                { (canUpdateTeam || canDisableTeam) &&
                    <Grid size={{ xs: 12 }}>
                        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
                            <TeamQuickActions name={team.name}
                                              disableTeamFn={disableTeamFn}
                                              enableTeamFn={enableTeamFn}
                                              resetKeyFn={resetTeamKeyFn} />
                        </Stack>
                    </Grid> }

                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="slug" label="Slug" fullWidth size="small" required
                                      slotProps={{ input: { readOnly: true } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="environment" label="Environment" fullWidth size="small"
                                   required options={environments}
                                   slotProps={{ select: { readOnly: !!readOnly } }} />
                </Grid>

                <Grid size={{ xs: 6, md: 3 }}>
                    <TextFieldElement name="title" label="Team title" fullWidth size="small" required
                                      slotProps={{ input: { readOnly: !!readOnly } }} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <TextFieldElement name="department" label="Team department" fullWidth size="small"
                                      slotProps={{ input: { readOnly: !!readOnly } }} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <TextFieldElement name="name" label="Team name" fullWidth size="small" required
                                      slotProps={{ input: { readOnly: !!readOnly } }} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <TextFieldElement name="plural" label="Team plural" fullWidth size="small" required
                                      slotProps={{ input: { readOnly: !!readOnly } }} />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <ColorInput name="colorDarkMode" label="Theme (Dark Mode)" fullWidth
                                size="small" required disabled={!!readOnly} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <ColorInput name="colorLightMode" label="Theme (Light Mode)" fullWidth size="small"
                                required disabled={!!readOnly} />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <TextareaAutosizeElement name="description" label="Description" fullWidth
                                             size="small" required
                                             slotProps={{ input: { readOnly: !!readOnly } }} />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <SelectElement name="emailAccountId" label="E-mail account" fullWidth size="small"
                                   required options={emailAccounts}
                                   slotProps={{ select: { readOnly: !!readOnly } }} />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <Divider />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <AutocompleteElementWithDisabledOptions
                        name="defaultRoleId" label="Default role" options={roles}
                        matchId autocompleteProps={{ fullWidth: true, readOnly, size: 'small' }} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <AutocompleteElement
                        name="availableRoleIds" label="Available roles" options={roles} multiple
                        matchId autocompleteProps={{ fullWidth: true, readOnly, size: 'small' }} />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <Divider />
                </Grid>

                <Grid size={{ xs: 12 }} sx={{ mt: -1, mb: -1 }}>
                    <List disablePadding>
                        { kFlags.map(entry =>
                            <Flag key={entry.field} readOnly={readOnly} {...entry} /> )}
                    </List>
                </Grid>
            </FormGridSection>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ team: 'slug' }, 'Structure', 'Organisation');
