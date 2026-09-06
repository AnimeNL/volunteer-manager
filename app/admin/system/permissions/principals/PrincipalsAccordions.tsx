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
     * Label of the scope, e.g. "Global" or "2025 · Stewards".
     */
    scope: string;

    /**
     * Optional source that indicates how the permission was granted, e.g. "Administrator".
     */
    source?: string;
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
 * Represents a group of users under an expanded accordion row.
 */
interface UserGroup {
    key: string;
    title: string;
    users: PrincipalUser[];
}

/**
 * Renders a group of users as a cluster of compact chips.
 */
function UserGroupSection(props: { group: UserGroup }) {
    const { group } = props;
    return (
        <Box sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
            <Typography variant="caption"
                        sx={{
                            color: 'text.secondary',
                            display: 'block',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            mb: 0.5,
                            textTransform: 'uppercase',
                        }}>
                {group.title} ({group.users.length})
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                { group.users.map(user =>
                    <Tooltip key={user.id} title={user.name} arrow>
                        <Box component={Link}
                             href={`/admin/organisation/accounts/${user.id}/permissions`}
                             sx={{
                                 display: 'inline-flex',
                                 borderRadius: '50%',
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

                // Group users by their scope and optional grant source
                const groupsMap = new Map<string, PrincipalUser[]>();
                for (const user of item.users) {
                    for (const s of user.scopes) {
                        let title = s.scope;
                        if (s.source && s.source !== s.scope) {
                            title = s.scope === 'Global'
                                ? `${s.source} (Global)`
                                : `${s.scope} (${s.source})`;
                        }

                        let group = groupsMap.get(title);
                        if (!group) {
                            group = [];
                            groupsMap.set(title, group);
                        }
                        if (!group.some(u => u.id === user.id))
                            group.push(user);
                    }
                }

                const groups: UserGroup[] = [ ...groupsMap.entries() ].map(([ title, users ]) => ({
                    key: title,
                    title,
                    users: users.sort((a, b) => a.name.localeCompare(b.name)),
                }));

                groups.sort((a, b) => {
                    const aGlobal = a.title.includes('Global') || a.title.includes('Direct grant');
                    const bGlobal = b.title.includes('Global') || b.title.includes('Direct grant');
                    if (aGlobal && !bGlobal) return -1;
                    if (!aGlobal && bGlobal) return 1;
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
                                                  fontSize: '0.75rem'
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
                                <Alert severity="info" variant="outlined" sx={{ py: .25, px: 1.5 }}>
                                    Nobody has been granted access.
                                </Alert> }
                            { count > 0 &&
                                <Stack direction="column" spacing={1}>
                                    { groups.map(group =>
                                        <UserGroupSection key={group.key} group={group} /> )}
                                </Stack> }
                        </AccordionDetails>
                    </Accordion>
                );
            }) }
        </Box>
    );
}
