// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { Avatar } from '@components/Avatar';
import { useIsMobile } from '@app/admin/lib/useIsMobile';

/**
 * Information regarding a specific scope that a user has been granted access under.
 */
export interface PrincipalUserScope {
    /**
     * Type of access granted.
     */
    type: 'global' | 'event';

    /**
     * Name of the event when type is 'event', e.g. "AnimeCon 2026".
     */
    event?: string;

    /**
     * Slug of the event when type is 'event', e.g. "2026".
     */
    eventSlug?: string;

    /**
     * Name of the team when type is 'event', e.g. "Bag Room Crew".
     */
    team?: string;

    /**
     * Optional custom scope label if access is restricted, e.g. "All events · care,crew".
     */
    customScope?: string;

    /**
     * Optional source that indicates how the permission was granted, e.g. "Administrator".
     */
    source?: string;

    /**
     * Specific CRUD operations granted, if applicable and not all operations.
     */
    operations?: string[];
}

/**
 * Information stored for a user who holds a role or permission.
 */
export interface PrincipalUser {
    /**
     * Unique ID that identifies this user.
     */
    id: number;

    /**
     * Full display name that the user is identified by.
     */
    name: string;

    /**
     * URL to the avatar image that represents this person, if any.
     */
    avatar?: string;

    /**
     * Scopes under which the user holds this role or permission.
     */
    scopes: PrincipalUserScope[];
}

/**
 * Information for an item (role or permission) displayed in the principals accordion.
 */
export interface PrincipalRecord {
    /**
     * Unique identifier of the role or permission, e.g. "root" or "event.applications".
     */
    id: string;

    /**
     * Human-readable name of the item.
     */
    name: string;

    /**
     * Description explaining what access the item grants.
     */
    description: string;

    /**
     * Users who hold this role or have been granted this permission.
     */
    users: PrincipalUser[];
}

/**
 * Represents a subgroup of users under a top-level scope group.
 */
interface Subgroup {
    key: string;
    title?: string;
    operations?: string;
    users: PrincipalUser[];
}

/**
 * Represents a top-level scope group (Global access or an Event).
 */
interface ScopeGroup {
    key: string;
    title: string;
    type: 'global' | 'event';
    subgroups: Subgroup[];
}

const PrincipalAccordion = styled(Accordion)(({ theme }) => ({
    '&:before': {
        display: 'none',
    },
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: `${theme.shape.borderRadius}px !important`,
    marginBottom: theme.spacing(0.5),
    overflow: 'hidden',
}));

const PrincipalAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
    minHeight: '44px !important',
    padding: theme.spacing(0, 1.5),

    '& .MuiAccordionSummary-content': {
        margin: theme.spacing(0.75, 0),
    },
}));

const UserAvatarLink = styled(Link)({
    borderRadius: '50%',
    display: 'inline-flex',
    textDecoration: 'none',
    transition: 'transform 0.1s ease-in-out',

    '&:hover': {
        transform: 'scale(1.15)',
    },
});

const OperationBadge = styled('span')<{ hasTitle?: boolean }>(({ theme, hasTitle }) => ({
    backgroundColor: theme.palette.action.selected,
    borderRadius: '4px',
    color: theme.palette.info.main,
    fontWeight: 700,
    marginLeft: hasTitle ? theme.spacing(0.75) : 0,
    padding: theme.spacing(0.125, 0.5),
}));

/**
 * Formats partial CRUD operations into a readable string.
 */
function formatOperations(operations?: string[]): string | undefined {
    if (!operations || operations.length === 0)
        return undefined;

    if (operations.length === 1)
        return `${operations[0]} only`;

    return operations.join(', ');
}

/**
 * Resolves the human-readable subgroup title for a given user scope.
 */
function resolveSubgroupTitle(scope: PrincipalUserScope): string | undefined {
    if (scope.type === 'global') {
        if (scope.customScope && scope.source)
            return `${scope.customScope} (${scope.source})`;

        return scope.customScope || scope.source;
    }

    const team = scope.team || 'Unknown team';
    if (scope.source && scope.source !== team)
        return `${team} (${scope.source})`;

    return team;
}

/**
 * Groups a principal's users hierarchically by scope type (Global vs. Events),
 * then sub-grouped by team and source grant.
 */
function groupUsersByScope(users: PrincipalUser[]): ScopeGroup[] {
    const scopeGroupsMap = new Map<string, {
        group: ScopeGroup;
        subgroupsMap: Map<string, {
            title?: string;
            operations?: string;
            users: PrincipalUser[];
        }>;
    }>();

    for (const user of users) {
        for (const scope of user.scopes) {
            const groupKey =
                scope.type === 'global' ? 'global' : `event:${scope.eventSlug || scope.event}`;
            const groupTitle =
                scope.type === 'global' ? 'Global access' : (scope.event || 'Unknown event');

            let groupEntry = scopeGroupsMap.get(groupKey);
            if (!groupEntry) {
                groupEntry = {
                    group: {
                        key: groupKey,
                        title: groupTitle,
                        type: scope.type,
                        subgroups: [],
                    },
                    subgroupsMap: new Map(),
                };
                scopeGroupsMap.set(groupKey, groupEntry);
            }

            const subTitle = resolveSubgroupTitle(scope);
            const opsLabel = formatOperations(scope.operations);
            const subKey = `${subTitle || ''}|${opsLabel || ''}`;

            let subEntry = groupEntry.subgroupsMap.get(subKey);
            if (!subEntry) {
                subEntry = {
                    title: subTitle,
                    operations: opsLabel,
                    users: [],
                };
                groupEntry.subgroupsMap.set(subKey, subEntry);
            }

            if (!subEntry.users.some(u => u.id === user.id))
                subEntry.users.push(user);
        }
    }

    const scopeGroups: ScopeGroup[] = [];
    for (const { group, subgroupsMap } of scopeGroupsMap.values()) {
        const subgroups: Subgroup[] = [];
        for (const [ subKey, subEntry ] of subgroupsMap.entries()) {
            subgroups.push({
                key: subKey,
                title: subEntry.title,
                operations: subEntry.operations,
                users: subEntry.users.sort((a, b) => a.name.localeCompare(b.name)),
            });
        }

        subgroups.sort((a, b) => {
            const titleA = a.title || '';
            const titleB = b.title || '';

            if (titleA !== titleB)
                return titleA.localeCompare(titleB);

            return (a.operations || '').localeCompare(b.operations || '');
        });

        group.subgroups = subgroups;

        scopeGroups.push(group);
    }

    scopeGroups.sort((a, b) => {
        if (a.type === 'global') return -1;
        if (b.type === 'global') return 1;

        return a.title.localeCompare(b.title);
    });

    return scopeGroups;
}

/**
 * Renders a stack of user avatars with tooltips.
 */
function UserAvatarStack(props: { users: PrincipalUser[] }) {
    return (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            { props.users.map(user =>
                <Tooltip key={user.id} title={user.name} arrow>
                    <UserAvatarLink href={`/admin/organisation/accounts/${user.id}/permissions`}>
                        <Avatar src={user.avatar}>
                            {user.name}
                        </Avatar>
                    </UserAvatarLink>
                </Tooltip> ) }
        </Stack>
    );
}

/**
 * Renders a subgroup of users with its title and operations badge.
 */
function SubgroupSection(props: { subgroup: Subgroup }) {
    return (
        <Box>
            <Typography variant="caption"
                        sx={{
                            alignItems: 'center',
                            color: 'text.secondary',
                            display: 'flex',
                            flexWrap: 'wrap',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            mb: 0.5,
                            textTransform: 'uppercase',
                        }}>
                { !!props.subgroup.title &&
                    <span>{props.subgroup.title}</span> }
                { !!props.subgroup.operations && (
                    <OperationBadge hasTitle={!!props.subgroup.title}>
                        {props.subgroup.operations}
                    </OperationBadge>
                ) }
                <Box component="span" sx={{ ml: 0.5 }}>
                    ({props.subgroup.users.length})
                </Box>
            </Typography>
            <UserAvatarStack users={props.subgroup.users} />
        </Box>
    );
}

/**
 * Renders an accordion item for a single role or permission record.
 */
function PrincipalAccordionItem(props: { isMobile: boolean; item: PrincipalRecord }) {
    const { isMobile, item } = props;

    const count = item.users.length;
    const countLabel = count === 1 ? '1 account' : `${count} accounts`;
    const scopeGroups = groupUsersByScope(item.users);

    return (
        <PrincipalAccordion disableGutters elevation={0}>
            <PrincipalAccordionSummary expandIcon={ <ExpandMoreIcon fontSize="small" /> }>
                <Stack direction="row" spacing={1}
                       sx={{
                           alignItems: 'center',
                           flex: 1,
                           flexWrap: 'wrap',
                           justifyContent: 'space-between',
                           mr: 1,
                           rowGap: 0.5,
                       }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {item.name}
                        </Typography>
                        { !isMobile &&
                            <Chip label={item.id} size="small" variant="outlined"
                                  sx={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                  }} /> }
                    </Stack>
                    <Chip color={ count > 0 ? 'primary' : 'default' }
                          label={countLabel}
                          size="small"
                          variant={ count > 0 ? 'filled' : 'outlined' } />
                </Stack>
            </PrincipalAccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {item.description}
                </Typography>
                <Divider sx={{ mb: 1 }} />
                { count === 0 &&
                    <Alert severity="info" variant="outlined" sx={{ py: 0.25, px: 1.5 }}>
                        Nobody has been granted access.
                    </Alert> }
                { count > 0 &&
                    <Stack direction="column" spacing={1.5}>
                        { scopeGroups.map(group => {
                            const hasSingleUntitledSubgroup =
                                group.subgroups.length === 1 &&
                                !group.subgroups[0].title &&
                                !group.subgroups[0].operations;

                            const groupTitle = hasSingleUntitledSubgroup
                                ? `${group.title} (${group.subgroups[0].users.length})`
                                : group.title;

                            return (
                                <Box key={group.key}>
                                    <Typography variant="body2"
                                                sx={{
                                                    color: 'text.primary',
                                                    fontWeight: 600,
                                                    mb: 0.75,
                                                }}>
                                        {groupTitle}
                                    </Typography>
                                    <Box sx={{
                                        borderLeft: 1,
                                        borderColor: 'divider',
                                        ml: 0.5,
                                        pl: 1.5,
                                    }}>
                                        { hasSingleUntitledSubgroup ? (
                                            <UserAvatarStack
                                                users={group.subgroups[0].users} />
                                        ) : (
                                            <Stack direction="column" spacing={1}>
                                                { group.subgroups.map(subgroup =>
                                                    <SubgroupSection
                                                        key={subgroup.key}
                                                        subgroup={subgroup} />) }
                                            </Stack>
                                        ) }
                                    </Box>
                                </Box>
                            );
                        }) }
                    </Stack> }
            </AccordionDetails>
        </PrincipalAccordion>
    );
}

/**
 * Props accepted by the <PrincipalsAccordion> component.
 */
interface PrincipalsAccordionProps {
    /**
     * Message to display when no items exist in this section.
     */
    emptyMessage?: string;

    /**
     * Items (roles or permissions) to display in the accordion.
     */
    items: PrincipalRecord[];
}

/**
 * The <PrincipalsAccordion> component displays an expandable accordion list of roles or permissions
 * and the accounts who hold them.
 */
export function PrincipalsAccordion(props: PrincipalsAccordionProps) {
    const { emptyMessage = 'No items configured.', items } = props;

    const isMobile = useIsMobile();

    if (!items.length) {
        return (
            <Alert severity="info">
                {emptyMessage}
            </Alert>
        );
    }

    return (
        <Box>
            { items.map(item =>
                <PrincipalAccordionItem key={item.id} isMobile={isMobile} item={item} />) }
        </Box>
    );
}
