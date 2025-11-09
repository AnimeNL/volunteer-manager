// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import Alert from '@mui/material/Alert';

import { Section } from '@app/admin/components/Section';
import { SettingSection, type ConfigurableSetting } from './SettingSection';
import { readSettings, type Setting } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { SettingUtilitiesSection } from './SettingUtilitiesSection';

/**
 * The Settings page lists configurable settings part of the AnimeCon Volunteer Manager that are not
 * exposed through other parts of the system.
 */
export default async function IntegrationsPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.settings',
    });

    // The configuration for settings contains the individual settings, the data types, and the
    // default values in case none could be retrieved from the database. The page's content will be
    // dynamically composed based on this configuration.
    const settingsConfiguration: { [k: string]: ConfigurableSetting[] } = {
        'Display settings': [
            {
                setting: 'display-check-in-rate-seconds',
                type: 'number',
                defaultValue: 60,

                label: 'Check-in interval',
                description:
                    'Every how many seconds should displays "phone home" for updated information?',
            },
            {
                setting: 'display-check-in-rate-help-requested-seconds',
                type: 'number',
                defaultValue: 30,

                label: 'Check-in interval (w/ help request)',
                description:
                    'Every how many seconds should displays "phone home" when help was requested?',
            },
            {
                setting: 'display-confirm-volume-change',
                type: 'boolean',
                defaultValue: false,

                label: 'Confirm volume changes',
                description:
                    'When set, a sound will play to confirm volume changes on the device',
            },
            {
                setting: 'display-dev-environment-link',
                type: 'string',
                defaultValue: '',

                label: 'Dev environment link',
                description:
                    'When set, a menu item will be included linking through to this URL',
            },
            {
                setting: 'display-request-advice',
                type: 'boolean',
                defaultValue: true,

                label: 'Enable requesting advice',
                description:
                    'When set, Del a Rie advice can be requested directly from the displays',
            },
            {
                setting: 'display-request-help',
                type: 'boolean',
                defaultValue: true,

                label: 'Enable requesting help',
                description: 'When set, help can be requested directly from the displays',
            },
            {
                setting: 'display-max-time-since-check-in-days',
                type: 'number',
                defaultValue: 90,

                label: 'Maximum time since check-in',
                description:
                    'After how many days of inactivity should we stop considering a display?',
            },
            {
                setting: 'display-time-offset-seconds',
                type: 'number',
                defaultValue: 0,

                label: 'Time offset (seconds)',
                description:
                    'Number of seconds to offset time with, to emulate the display at another ' +
                    'point in time',
            }
        ],
        'Event settings': [
            {
                setting: 'application-publish-on-move',
                type: 'boolean',
                defaultValue: false,

                label: 'Applications - publish on move',
                description:
                    'Should an application be published when it has been moved from one team to ' +
                    'another?',
            },
            {
                setting: 'availability-max-event-duration-minutes',
                type: 'number',
                defaultValue: 180,

                label: 'Availability - duration cutoff',
                description:
                    'What is the longest event, in minutes, to consider for availability ' +
                    'preferences?',
            },
            {
                setting: 'availability-time-step-minutes',
                type: 'number',
                defaultValue: 15,

                label: 'Availability - time step',
                description:
                    'Time step, in minutes, defining granularity of events in availability ' +
                    'exceptions.',
            },
            {
                setting: 'program-event-sales-relative',
                type: 'boolean',
                defaultValue: true,

                label: 'Program - relative sales graphs',
                description: 'Whether sales graph date ranges should be relative to the festival',
            },
            {
                setting: 'retention-number-of-events-to-consider',
                type: 'number',
                defaultValue: 2,

                label: 'Retention - historical events',
                description: 'How many events should be considered for retention planning?',
            },
            {
                setting: 'retention-whatsapp-message',
                type: 'string',
                defaultValue: 'Hi {name}',

                label: 'Retention - WhatsApp message',
                description: 'Default WhatsApp message to compose',
            },
            {
                setting: 'schedule-day-view-start-time',
                type: 'string',
                defaultValue: '08:00',

                label: 'Schedule - start time (day view; HH:MM)',
                description: 'Time at which the day starts on schedule',
            },
            {
                setting: 'schedule-day-view-end-time',
                type: 'string',
                defaultValue: '27:30',

                label: 'Schedule - end time (day view; HH:MM)',
                description:
                    'Time at which the day ends on the schedule. May continue beyond midnight to ' +
                    'finish on the next day',
            },
            {
                setting: 'schedule-event-view-start-hours',
                type: 'number',
                defaultValue: 4,

                label: 'Schedule - start hours (event view)',
                description: 'Number of hours before opening that shifts can be scheduled',
            },
            {
                setting: 'schedule-event-view-end-hours',
                type: 'number',
                defaultValue: 4,

                label: 'Schedule - end hours (event view)',
                description: 'Number of hours after closing that shifts can be scheduled',
            },
            {
                setting: 'schedule-recent-shift-count',
                type: 'number',
                defaultValue: 4,

                label: 'Schedule - recent shifts',
                description: 'Number of recent shifts to display in the context menu',
            },
            {
                setting: 'schedule-time-step-minutes',
                type: 'number',
                defaultValue: 15,

                label: 'Schedule - time step',
                description:
                    'Time step, in minutes, defining granularity of shifts in the scheduling tools',
            },
            {
                setting: 'vendor-first-aid-email-address',
                type: 'string',
                defaultValue: 'crew@animecon.nl',

                label: 'Vendor - first aid e-mail address',
                description:
                    'E-mail address where tickets for first aid volunteers should be send to',
            },
            {
                setting: 'vendor-first-aid-roles',
                type: 'string',
                defaultValue: 'First Aid',

                label: 'Vendor - first aid roles',
                description: 'Comma-separated list of roles that can be assigned to first aiders',
            },
            {
                setting: 'vendor-security-roles',
                type: 'string',
                defaultValue: 'Security',

                label: 'Vendor - security roles',
                description: 'Comma-separated list of roles that can be assigned to security',
            }
        ],
        'Schedule settings': [
            {
                setting: 'schedule-activity-list-limit',
                type: 'number',
                defaultValue: 5,

                label: 'Activity list size',
                description:
                    'Number of active and pending activities to list for an area or location',
            },
            {
                setting: 'schedule-check-in-rate-seconds',
                type: 'number',
                defaultValue: 5 * 60,

                label: 'Client check-in rate (seconds)',
                description:
                    'Cadence at which clients should check in for an update on the schedule',
            },
            {
                setting: 'schedule-del-a-rie-advies',
                type: 'boolean',
                defaultValue: true,

                label: 'Del a Rie Advies',
                description: 'Whether the advice service should be enabled',
            },
            {
                setting: 'schedule-del-a-rie-advies-genai',
                type: 'boolean',
                defaultValue: false,

                label: 'Del a Rie Advies (GenAI)',
                description:
                    'Whether Del a Rie Advies can utilize generative AI to create personalised ' +
                    'advice',
            },
            {
                setting: 'schedule-del-a-rie-advies-time-limit',
                type: 'number',
                defaultValue: 5,

                label: 'Del a Rie Advies (advice interval)',
                description:
                    'Number of minutes that a particular piece of excellent advice should be ' +
                    'shown for',
            },
            {
                setting: 'schedule-favourite-events',
                type: 'boolean',
                defaultValue: false,

                label: 'Favourites',
                description: 'Enable volunteers to star their favourite events',
            },
            {
                setting: 'schedule-knowledge-base',
                type: 'boolean',
                defaultValue: true,

                label: 'Knowledge base',
                description: 'Whether the knowledge base should be enabled',
            },
            {
                setting: 'schedule-knowledge-base-search',
                type: 'boolean',
                defaultValue: true,

                label: 'Knowledge base (search)',
                description: 'Whether the search function should consider questions',
            },
            {
                setting: 'schedule-logical-days',
                type: 'boolean',
                defaultValue: false,

                label: 'Logical days',
                description:
                    'Whether shifts that finish before 4am should be counted as part of the ' +
                    'previous day',
            },
            {
                setting: 'schedule-sales-product-panel',
                type: 'boolean',
                defaultValue: false,

                label: 'Sales: Product panel w/o permission',
                description:
                    'Whether all senior volunteer should be able to see product panels ' +
                    'sales information',
            },
            {
                setting: 'schedule-sales-sold-out',
                type: 'boolean',
                defaultValue: false,

                label: 'Sales: Sold Out warnings',
                description: 'Whether all volunteers should be able to see Sold Out warnings',
            },
            {
                setting: 'schedule-search-candidate-fuzziness',
                type: 'number',
                defaultValue: 0.04,

                label: 'Search result candidate (fuzziness)',
                description: 'Fuzziness [0-1] to apply to search result matching',
            },
            {
                setting: 'schedule-search-candidate-minimum-score',
                type: 'number',
                defaultValue: 0.37,

                label: 'Search result candidate (min score)',
                description: 'Minimum score [0-1] required for a candidate to be considered',
            },
            {
                setting: 'schedule-search-result-limit',
                type: 'number',
                defaultValue: 5,

                label: 'Search result limit (inline)',
                description: 'Maximum number of inline search results that will be shown',
            },
            {
                setting: 'schedule-sort-past-days-last',
                type: 'boolean',
                defaultValue: true,

                label: 'Sort historic days last',
                description: 'Whether past days should be sorted to the bottom of the list',
            },
            {
                setting: 'schedule-sort-past-events-last',
                type: 'boolean',
                defaultValue: true,

                label: 'Sort historic events last',
                description: 'Whether past events should be sorted to the bottom of the list',
            },
            {
                setting: 'schedule-time-offset-seconds',
                type: 'number',
                defaultValue: 0,

                label: 'Time offset (seconds)',
                description:
                    'Number of seconds to offset time with, to emulate the schedule at another ' +
                    'point in time',
            },
            {
                setting: 'schedule-vendor-first-aid-card',
                type: 'boolean',
                defaultValue: false,

                label: 'Vendor card (first aid)',
                description: 'Inform all volunteers of on-site first aid vendors',
            },
            {
                setting: 'schedule-vendor-security-card',
                type: 'boolean',
                defaultValue: false,

                label: 'Vendor card (security)',
                description: 'Inform all volunteers of on-site security vendors',
            },
        ],
    };

    // In two steps, gather, then inject all the configured values included in the configuration.
    {
        const settings = new Set<Setting>();
        for (const entries of Object.values(settingsConfiguration)) {
            for (let index = 0; index < entries.length; ++index)
                settings.add(entries[index].setting);
        }

        const settingValues = await readSettings([ ...settings ]);
        for (const [ title, entries ] of Object.entries(settingsConfiguration)) {
            for (let index = 0; index < entries.length; ++index)
                settingsConfiguration[title][index].value = settingValues[entries[index].setting];
        }
    }

    return (
        <>
            <Section title="Volunteer Manager Settings">
                <Alert severity="info">
                    The following settings may be dynamically configured to alter the Volunteer
                    Manager's behaviour. While you can change them to anything you want, certain
                    values may cause functionality to break or behave in an unintended manner.
                </Alert>
            </Section>
            { Object.entries(settingsConfiguration).map(([ title, settings ]) =>
                <SettingSection key={title} title={title} settings={settings} /> )}
            <SettingUtilitiesSection />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Settings | AnimeCon Volunteer Manager',
};
