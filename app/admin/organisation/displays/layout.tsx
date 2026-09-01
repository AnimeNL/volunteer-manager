// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HelpIcon from '@mui/icons-material/Help';
import TabletIcon from '@mui/icons-material/Tablet';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The <DisplaysLayout> is the layout wrapper that provides navigation for the Display management,
 * which also includes visualising the received help requests.
 */
export default async function DisplaysLayout(props: LayoutProps<'/admin/organisation/displays'>) {
    const { access } = await requireAuthentication('organisation.displays');

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: TabletIcon,
                label: 'Devices',
                url: '/admin/organisation/displays',
                urlMatchMode: 'strict',
            },
            {
                Icon: HelpIcon,
                label: 'Help requests',
                url: '/admin/organisation/displays/requests',
                urlMatchMode: 'prefix',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
