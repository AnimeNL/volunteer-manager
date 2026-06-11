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

import type { AccessControl } from '@lib/auth/AccessControl';
import { AdminContentWrapper, AdminPageWrapper } from './layout/AdminComponents';
import { NavigationMenu } from './layout/NavigationMenu';
import { NavigationSidebar } from './layout/NavigationSidebar';
import { ThemeProvider } from './layout/ThemeProvider';
import { checkPermission } from '@lib/auth/AuthenticationContext';

import { kDashboardPermissions } from './organisation/dashboard/DashboardPermissions';

/**
 * Props accepted by the <AdminLayoutV2> component.
 */
interface AdminLayoutV2Props {
    /**
     * Interface through which volunteer access will be confirmed.
     */
    access: AccessControl;
}

/**
 * Root component of the new administration layout, which is a substantial step up from the original
 * Material UI-inspired design. Responsive and expressive from the get-go.
 */
export async function AdminLayoutV2(props: React.PropsWithChildren<AdminLayoutV2Props>) {
    const enableOrganisation = checkPermission(props.access, kDashboardPermissions);

    return (
        <ThemeProvider>
            <AdminPageWrapper direction="row" spacing={1}>
                <NavigationSidebar enableOrganisation={enableOrganisation} />
                <NavigationMenu title="AnimeCon" items={[
                    {
                        Icon: DashboardOutlinedIcon,
                        href: '/admin',
                        label: 'Dashboard',
                    },
                    {
                        Icon: TocIcon,
                        href: '/admin/content',
                        label: 'Content',
                    },
                    {
                        header: 'Communication',
                        items: [
                            {
                                Icon: OutboxOutlinedIcon,
                                badge: {
                                    value: 12,
                                },
                                href: '/admin/system/outbox/email',
                                label: 'Outbox',
                            },
                            {
                                Icon: StreamIcon,
                                href: '/admin/system/subscriptions',
                                label: 'Subscriptions',
                            },
                            {
                                Icon: WebhookIcon,
                                href: '/admin/system/webhooks',
                                label: 'Webhooks',
                            },
                        ],
                    },
                    {
                        header: 'System',
                        items: [
                            {
                                Icon: AutoAwesomeIcon,
                                href: '/admin/system/ai/communication',
                                label: 'AI',
                            },
                            {
                                Icon: QueryStatsIcon,
                                badge: {
                                    severity: 'error',
                                    value: 1,
                                },
                                href: '/admin/system/diagnostics/logs',
                                label: 'Diagnostics',
                            },
                            {
                                Icon: ApiIcon,
                                href: '/admin/system/integrations',
                                label: 'Integrations',
                            },
                            {
                                Icon: LoopIcon,
                                badge: {
                                    severity: 'warning',
                                    value: true,
                                },
                                href: '/admin/system/scheduler',
                                label: 'Scheduler',
                            },
                            {
                                Icon: SettingsOutlinedIcon,
                                href: '/admin/system/settings',
                                label: 'Settings',
                            }
                        ],
                    }
                ]} />
                <AdminContentWrapper>
                    {props.children}
                </AdminContentWrapper>
            </AdminPageWrapper>
        </ThemeProvider>
    );
}
