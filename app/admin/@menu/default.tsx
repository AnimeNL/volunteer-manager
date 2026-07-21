// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import ApiIcon from '@mui/icons-material/Api';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';
import LoopIcon from '@mui/icons-material/Loop';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import StorageIcon from '@mui/icons-material/Storage';
import StreamIcon from '@mui/icons-material/Stream';
import TocIcon from '@mui/icons-material/Toc';
import WebhookIcon from '@mui/icons-material/Webhook';

import { NavigationMenu } from '../layout/NavigationMenu';
import { Temporal } from '@lib/Temporal';
import { globalScheduler } from '@lib/scheduler/SchedulerImpl';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tOutboxEmail, tOutboxTwilio, tLogs, tTwilioWebhookCalls } from '@lib/database';

/**
 * By default, we display a loading menu as the real one cannot be determined yet. Intentionally
 * a lightweight component as it should rarely be displayed, if at all.
 */
export default async function DefaultMenu() {
    const { access, user } = await requireAuthenticationContext({ check: 'admin' });

    let badges: Record<string, number> = {
        integrations: 0,
        logs: 0,
        outbox: 0,
        webhooks: 0,
    };

    if (access.can('system.logs', 'read') || access.can('system.internals.outbox')) {
        const dbInstance = db;

        const exactlyOneDayAgo = Temporal.Now.zonedDateTimeISO().subtract({ days: 1 });

        const logsValue = dbInstance.selectFrom(tLogs)
            .where(tLogs.logDate.greaterOrEqual(exactlyOneDayAgo))
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const outboxEmailValue = dbInstance.selectFrom(tOutboxEmail)
            .where(tOutboxEmail.outboxTimestamp.greaterOrEqual(exactlyOneDayAgo))
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const outboxTwilioValue = dbInstance.selectFrom(tOutboxTwilio)
            .where(tOutboxTwilio.outboxTimestamp.greaterOrEqual(exactlyOneDayAgo))
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const twilioWebhookValue = dbInstance.selectFrom(tTwilioWebhookCalls)
            .where(tTwilioWebhookCalls.webhookCallDate.greaterOrEqual(exactlyOneDayAgo))
            .selectCountAll()
            .forUseAsInlineQueryValue();

        badges = await dbInstance.selectFromNoTable()
            .select({
                logs: logsValue,
                outbox: outboxEmailValue.add(outboxTwilioValue),
                webhooks: twilioWebhookValue,
            })
            .executeSelectOne();
    }

    if (access.can('system.internals.settings')) {
        const weeztixExpiration = await readSetting('integration-weeztix-refresh-token-expiration');
        if (!!weeztixExpiration) {
            const expirationInstant = Temporal.Instant.fromEpochMilliseconds(weeztixExpiration);
            const currentInstant = Temporal.Now.instant();

            const timeUntilExpiration = currentInstant.until(expirationInstant, {
                largestUnit: 'hours',
            });

            if (timeUntilExpiration.hours < /* 2 weeks= */ 14 * 24)
                badges.integrations = 1;
        }
    }

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
                url: '/admin/system/content',
            },
            {
                header: 'Communication',
                id: 'communication',
                items: [
                    {
                        Icon: OutboxOutlinedIcon,
                        badge: { value: badges.outbox },
                        label: 'Outbox',
                        permission: 'system.internals.outbox',
                        url: '/admin/system/outbox/email',
                        urlMatchMode: 'prefix',
                        urlPrefix: '/admin/system/outbox/',
                    },
                    {
                        Icon: StreamIcon,
                        label: 'Subscriptions',
                        permission: 'system.subscriptions.management',
                        url: '/admin/system/subscriptions',
                    },
                    {
                        Icon: WebhookIcon,
                        badge: { value: badges.webhooks },
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
                        Icon: FolderCopyOutlinedIcon,
                        label: 'Cache',
                        permission: 'system.internals',
                        url: '/admin/system/cache',
                    },
                    {
                        Icon: StorageIcon,
                        badge: { severity: 'warning', value: true },
                        condition: databaseQueryLogHasNonZeroValue(),
                        label: 'Database',
                        permission: 'root',
                        url: '/admin/system/database',
                    },
                    {
                        Icon: QueryStatsIcon,
                        badge: { value: badges.logs },
                        label: 'Diagnostics',
                        permission: {
                            permission: 'system.logs',
                            operation: 'read',
                        },
                        url: '/admin/system/diagnostics/logs',
                        urlPrefix: '/admin/system/diagnostics/',
                    },
                    {
                        Icon: ApiIcon,
                        badge: { severity: 'warning', value: !!badges.integrations },
                        label: 'Integrations',
                        permission: 'root',
                        url: '/admin/system/integrations',
                    },
                    {
                        Icon: LoopIcon,
                        badge:
                            globalScheduler.lastInvocation ? undefined
                                                           : { severity: 'warning', value: true },
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

/**
 * Returns whether the `APP_DATABASE_QUERY_LOG` environment variable has been set.
 */
function databaseQueryLogHasNonZeroValue(): boolean {
    const value = process.env.APP_DATABASE_QUERY_LOG;
    if (typeof value === 'string') {
        const numericalValue = parseInt(value, /* radix= */ 10);
        return !isNaN(numericalValue) && numericalValue > 0;
    }

    return false;
}
