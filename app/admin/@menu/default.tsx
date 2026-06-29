// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import ApiIcon from '@mui/icons-material/Api';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import LoopIcon from '@mui/icons-material/Loop';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import StreamIcon from '@mui/icons-material/Stream';
import TocIcon from '@mui/icons-material/Toc';
import WebhookIcon from '@mui/icons-material/Webhook';

import { NavigationMenu } from '../layout/NavigationMenu';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * By default, we display a loading menu as the real one cannot be determined yet. Intentionally
 * a lightweight component as it should rarely be displayed, if at all.
 */
export default async function DefaultMenu() {
    const { access, user } = await requireAuthenticationContext({ check: 'admin' });
    return (
        <NavigationMenu access={access} id="dashboard" title="AnimeCon" items={[
            {
                Icon: DashboardOutlinedIcon,
                label: 'Dashboard',
                url: '/admin',
                urlMatchMode: 'strict',
            },
            {
                Icon: TocIcon,
                label: 'Content',
                permission: 'system.content',
                url: '/admin/content',
            },
            {
                header: 'Communication',
                id: 'communication',
                items: [
                    {
                        Icon: OutboxOutlinedIcon,
                        badge: { severity: 'success', value: true },  // migration completed
                        label: 'Outbox',
                        permission: 'system.internals.outbox',
                        url: '/admin/system/outbox/email',
                        urlMatchMode: 'prefix',
                        urlPrefix: '/admin/system/outbox/',
                    },
                    {
                        Icon: StreamIcon,
                        badge: { severity: 'success', value: true },  // migration completed
                        label: 'Subscriptions',
                        permission: 'system.subscriptions.management',
                        url: '/admin/system/subscriptions',
                    },
                    {
                        Icon: WebhookIcon,
                        badge: { severity: 'success', value: true },  // migration completed
                        label: 'Webhooks',
                        permission: 'system.internals.outbox',
                        url: '/admin/system/webhooks',
                    },
                ],
            },
            {
                defaultExpanded: true,
                header: 'System',
                id: 'system',
                items: [
                    {
                        Icon: AutoAwesomeIcon,
                        label: 'AI',
                        permission: 'system.internals.ai',
                        url: '/admin/system/ai/communication',
                    },
                    {
                        Icon: QueryStatsIcon,
                        badge: { severity: 'warning', value: true },  // migration in progress
                        label: 'Diagnostics',
                        url: '/admin/system/diagnostics/logs',
                    },
                    {
                        Icon: ApiIcon,
                        label: 'Integrations',
                        permission: 'root',
                        url: '/admin/system/integrations',
                    },
                    {
                        Icon: LoopIcon,
                        badge: { severity: 'success', value: true },  // migration completed
                        label: 'Scheduler',
                        permission: 'system.internals.scheduler',
                        url: '/admin/system/scheduler',
                    },
                    {
                        Icon: SettingsOutlinedIcon,
                        label: 'Settings',
                        permission: 'system.internals.settings',
                        url: '/admin/system/settings',
                    }
                ],
            }
        ]} userId={user.id} />
    );
}
