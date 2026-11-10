// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { ToggleButtonGroupElement } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import Grid from '@mui/material/Grid';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';

import { FormGrid } from '@app/admin/components/FormGrid';
import { InboxAccountIcon } from './InboxAccountIcon';
import { InlineAccountLink } from '@app/admin/components/InlineAccountLink';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { queryUsersWithPermission } from '@lib/auth/AccessQuery';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tEmailAccountsPermissions, tUsers } from '@lib/database';

import { kInboxOperations } from '../../InboxAccess';

import { updateInboxPermissions } from '../InboxPermissionActions';

/**
 * Operations available for assignment on each inbound e-mail account.
 */
const kOperationOptions = [
    {
        id: 'create',
        label: (
            <Tooltip title="Write">
                <TooltipIconWrapper>
                    <EditOutlinedIcon fontSize="small" />
                </TooltipIconWrapper>
            </Tooltip>
        ),
    },
    {
        id: 'read',
        label: (
            <Tooltip title="Read">
                <TooltipIconWrapper>
                    <FormatListBulletedIcon fontSize="small" />
                </TooltipIconWrapper>
            </Tooltip>
        ),
    },
    {
        id: 'delete',
        label: (
            <Tooltip title="Delete">
                <TooltipIconWrapper>
                    <DeleteOutlinedIcon fontSize="small" />
                </TooltipIconWrapper>
            </Tooltip>
        ),
    },
];

/**
 * Props accepted by the <InboxPermissionListItem> component.
 */
interface InboxPermissionListItemProps {
    /**
     * E-mail address associated with the inbox.
     */
    address: string;

    /**
     * Whether a divider should be rendered below this list item.
     */
    divider: boolean;

    /**
     * Unique ID of the e-mail account (`email_accounts.email_account_id`).
     */
    id: number;
}

/**
 * Renders a single inbound e-mail account row with its permission toggle buttons.
 */
function InboxPermissionListItem(props: InboxPermissionListItemProps) {
    const fieldName = `inbox-${props.id}`;

    return (
        <ListItem disableGutters divider={props.divider}>
            <ListItemIcon>
                <InboxAccountIcon name={fieldName} />
            </ListItemIcon>
            <ListItemText primary={props.address}
                          slotProps={{
                              primary: { noWrap: true, variant: 'body2' },
                          }} />
            <Box sx={{ ml: 2 }}>
                <ToggleButtonGroupElement name={fieldName} options={kOperationOptions}
                                          color="primary" size="small" />
            </Box>
        </ListItem>
    );
}

/**
 * Page allowing explicit inbox permissions for an individual account to be viewed and updated.
 */
export default async function AccountInboxPermissionsPage(
    props: PageProps<'/admin/system/inbox/permissions/[id]'>)
{
    await requireAuthentication('system.inbox.management');

    const params = await props.params;

    const userId = parseInt(params.id, /* radix= */ 10);
    if (!Number.isSafeInteger(userId))
        notFound();

    const dbInstance = db;

    const user = await dbInstance.selectFrom(tUsers)
        .where(tUsers.userId.equals(userId))
            .and(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
        })
        .executeSelectNoneOrOne();

    if (!user)
        notFound();

    const permissionsJoin = tEmailAccountsPermissions.forUseInLeftJoin();

    const [ eligibleUsers, inboxes ] = await Promise.all([
        queryUsersWithPermission('system.inbox.eligible'),
        dbInstance.selectFrom(tEmailAccounts)
            .leftJoin(permissionsJoin)
                .on(permissionsJoin.emailAccountId.equals(tEmailAccounts.emailAccountId))
                    .and(permissionsJoin.userId.equals(user.id))
            .where(tEmailAccounts.emailAccountDeleted.isNull())
                .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
            .select({
                id: tEmailAccounts.emailAccountId,
                address: tEmailAccounts.emailAccountAddress,
                permissions: {
                    create: permissionsJoin.permissionCreate.equals(/* true= */ 1),
                    read: permissionsJoin.permissionRead.equals(/* true= */ 1),
                    delete: permissionsJoin.permissionDelete.equals(/* true= */ 1),
                },
            })
            .orderBy(tEmailAccounts.emailAccountAddress, 'asc')
            .executeSelectMany(),
    ]);

    const isEligible = eligibleUsers.some(candidate => candidate.id === user.id);

    const defaultValues: Record<string, string[]> = { /* empty */ };
    for (const inbox of inboxes) {
        const operations = kInboxOperations.filter(op => !!inbox.permissions?.[op]);
        if (operations.length > 0)
            defaultValues[`inbox-${inbox.id}`] = operations;
    }

    const serverAction = updateInboxPermissions.bind(null, user.id);

    return (
        <>
            <Section icon={ <InboxOutlinedIcon color="primary" /> }
                     title={`Inbox permissions for ${user.firstName}`}
                     breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Inbox permissions', href: '/admin/system/inbox/permissions' },
                         { label: user.firstName },
                     ]}>
                <SectionIntroduction>
                    Explicit inbound e-mail account permissions assigned to{' '}
                    <InlineAccountLink user={user} />.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                { inboxes.length === 0 ? (
                    <Alert severity="info" variant="outlined">
                        No inbound e-mail accounts have been configured yet. Configure IMAP server
                        details on an e-mail account to manage inbox permissions.
                    </Alert>
                ) : (
                    <FormGrid action={serverAction} defaultValues={defaultValues}>
                        { !isEligible &&
                            <Grid size={{ xs: 12 }}>
                                <Alert severity="warning" variant="outlined">
                                    {user.firstName} does not currently hold the inbox eligibility
                                    permission, so assigned inboxes cannot be accessed until that
                                    permission is granted.
                                </Alert>
                            </Grid> }
                        <Grid size={{ xs: 12 }}>
                            <List disablePadding sx={{ my: -2 }}>
                                { inboxes.map((inbox, index) =>
                                    <InboxPermissionListItem
                                        key={inbox.id}
                                        id={inbox.id}
                                        address={inbox.address}
                                        divider={ index < inboxes.length - 1 } /> ) }
                            </List>
                        </Grid>
                    </FormGrid>
                ) }
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ user: 'id' }, 'Inbox permissions', 'Communication');
