// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

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
 * Represents a subgroup of users under a top-level scope group.
 */
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

/**
 * Renders a stack of user avatars with tooltips.
 */
function UserAvatarStack(props: { users: PrincipalUser[] }) {
    const { users } = props;
    return (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            { users.map(user =>
                <Tooltip key={user.id} title={user.name} arrow>
                    <Box component={Link}
                         href={`/admin/organisation/accounts/${user.id}/permissions`}
                         sx={{
                             borderRadius: '50%',
                             display: 'inline-flex',
                             textDecoration: 'none',
                             transition: 'transform 0.1s ease-in-out',
                             '&:hover': {
                                 transform: 'scale(1.15)',
                             },
                         }}>
                        <Avatar src={user.avatar}>
                            {user.name}
                        </Avatar>
                    </Box>
                </Tooltip> ) }
        </Stack>
    );
}

/**
 * Renders a subgroup of users with its title and operations badge.
 */
function SubgroupSection(props: { subgroup: Subgroup }) {
    const { subgroup } = props;
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
                { !!subgroup.title &&
                    <span>{subgroup.title}</span> }
                { !!subgroup.operations && (
                    <Box component="span"
                         sx={{
                             bgcolor: 'action.selected',
                             borderRadius: '4px',
                             color: 'info.main',
                             fontWeight: 700,
                             ml: subgroup.title ? 0.75 : 0,
                             px: 0.5,
                             py: 0.125,
                         }}>
                        {subgroup.operations}
                    </Box>
                ) }
                <Box component="span" sx={{ ml: 0.5 }}>
                    ({subgroup.users.length})
                </Box>
            </Typography>
            <UserAvatarStack users={subgroup.users} />
        </Box>
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
            { items.map(item => {
                const count = item.users.length;
                const countLabel = count === 1 ? '1 account' : `${count} accounts`;

                // Group users hierarchically: top-level by scope type (Global vs. Events),
                // then sub-grouped by team and source grant.
                const scopeGroupsMap = new Map<string, {
                    group: ScopeGroup;
                    subgroupsMap: Map<string, {
                        title?: string;
                        operations?: string;
                        users: PrincipalUser[];
                    }>;
                }>();

                for (const user of item.users) {
                    for (const s of user.scopes) {
                        const groupKey =
                            s.type === 'global' ? 'global' : `event:${s.eventSlug || s.event}`;
                        const groupTitle =
                            s.type === 'global' ? 'Global access' : (s.event || 'Unknown event');

                        let groupEntry = scopeGroupsMap.get(groupKey);
                        if (!groupEntry) {
                            groupEntry = {
                                group: {
                                    key: groupKey,
                                    title: groupTitle,
                                    type: s.type,
                                    subgroups: [],
                                },
                                subgroupsMap: new Map(),
                            };
                            scopeGroupsMap.set(groupKey, groupEntry);
                        }

                        let subTitle: string | undefined;
                        const opsLabel = formatOperations(s.operations);

                        if (s.type === 'global') {
                            let sourceLabel = s.customScope;
                            if (s.source) {
                                sourceLabel = sourceLabel
                                    ? `${sourceLabel} (${s.source})`
                                    : s.source;
                            }
                            subTitle = sourceLabel;
                        } else {
                            const team = s.team || 'Unknown team';
                            if (s.source && s.source !== team)
                                subTitle = `${team} (${s.source})`;
                            else
                                subTitle = team;
                        }

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

                return (
                    <Accordion key={item.id} disableGutters elevation={0} sx={{
                        '&:before': { display: 'none' },
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: '4px !important',
                        mb: 0.5,
                        overflow: 'hidden',
                    }}>
                        <AccordionSummary expandIcon={ <ExpandMoreIcon fontSize="small" /> }
                                          sx={{
                                              minHeight: '44px !important',
                                              px: 1.5,
                                              py: 0,
                                              '& .MuiAccordionSummary-content': { my: 0.75 },
                                          }}>
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
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {item.description}
                            </Typography>
                            <Divider sx={{ mb: 1 }} />
                            { count === 0 &&
                                <Alert severity="info" variant="outlined"
                                       sx={{ py: .25, px: 1.5 }}>
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
                    </Accordion>
                );
            }) }
        </Box>
    );
}
