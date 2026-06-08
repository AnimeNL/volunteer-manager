// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AdminPageWrapper } from './AdminLayoutClientV2';
import { NavigationMenu } from './layout/NavigationMenu';
import { NavigationSidebar } from './layout/NavigationSidebar';
import { ThemeProvider } from './layout/ThemeProvider';

/**
 * Root component of the new administration layout, which is a substantial step up from the original
 * Material UI-inspired design. Responsive and expressive from the get-go.
 */
export async function AdminLayoutV2(props: React.PropsWithChildren) {
    return (
        <ThemeProvider>
            <AdminPageWrapper direction="row" spacing={1}>
                <NavigationSidebar />
                <NavigationMenu title="AnimeCon" items={[
                    {
                        href: '/admin',
                        label: 'Dashboard',
                    },
                    {
                        href: '/admin/content',
                        label: 'Content',
                    },
                    {
                        header: 'Communication',
                        items: [
                            {
                                href: '/admin/system/outbox/email',
                                label: 'Outbox',
                            },
                            {
                                href: '/admin/system/subscriptions',
                                label: 'Subscriptions',
                            },
                            {
                                href: '/admin/system/webhooks',
                                label: 'Webhooks',
                            },
                        ],
                    },
                    {
                        header: 'System',
                        items: [
                            {
                                href: '/admin/system/ai/communication',
                                label: 'AI',
                            },
                            {
                                href: '/admin/system/diagnostics/logs',
                                label: 'Diagnostics',
                            },
                            {
                                href: '/admin/system/integrations',
                                label: 'Integrations',
                            },
                            {
                                href: '/admin/system/scheduler',
                                label: 'Scheduler',
                            },
                            {
                                href: '/admin/system/settings',
                                label: 'Settings',
                            }
                        ],
                    }
                ]} />
                {props.children}
            </AdminPageWrapper>
        </ThemeProvider>
    );
}
