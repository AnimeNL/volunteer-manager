// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EuroIcon from '@mui/icons-material/Euro';

import type { NextPageParams } from '@lib/NextRouterParams';
import { SettingsDataTable } from './SettingsDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <FinanceSettingsPage> component represents the settings related to the financial information
 * of a particular event, such as ticket prices and event associations.
 */
export default async function FinancePage(props: NextPageParams<'event'>) {
    const { event } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.settings',
        scope: {
            event: (await props.params).event,
        },
    });

    return (
        <>
            <Section title="Financial settings" subtitle={event.shortName}
                     icon={ <EuroIcon color="primary" /> }>
                <SectionIntroduction>
                    These are the financial settings for {event.shortName}. Information imported
                    from our ticketing partner is authoritative and may override any modifications.
                </SectionIntroduction>
                <SettingsDataTable event={event.slug} />
            </Section>
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Finance settings');
