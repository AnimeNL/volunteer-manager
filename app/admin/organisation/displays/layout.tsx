// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import HelpIcon from '@mui/icons-material/Help';
import Paper from '@mui/material/Paper';
import TabletIcon from '@mui/icons-material/Tablet';

import { NavigationTabs, type NavigationTabsProps } from '@app/admin/components/NavigationTabs';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <DisplaysLayout> is the layout wrapper that provides navigation for the Display management,
 * which also includes visualising the received help requests.
 */
export default async function DisplaysLayout(props: LayoutProps<'/admin/organisation/displays'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.displays',
    });

    // ---------------------------------------------------------------------------------------------
    // Determine the tabs that the signed in user has access to
    // ---------------------------------------------------------------------------------------------

    const tabs: NavigationTabsProps['tabs'] = [
        {
            icon: <TabletIcon />,
            label: 'Devices',
            url: '/admin/organisation/displays',
            urlMatchMode: 'strict',
        },
        {
            icon: <HelpIcon />,
            label: 'Help requests',
            url: '/admin/organisation/displays/requests',
            urlMatchMode: 'prefix',
        },
    ];

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Section icon={ <TabletIcon color="primary" /> } title="Displays">
                <SectionIntroduction>
                    We distribute <strong>physical displays</strong> during the festival to help
                    busy areas self-manage their volunteers. They automatically register with the
                    Volunteer Manager, and can be provisioned and controlled through this interface.
                    Updates can take a few minutes to propagate.
                </SectionIntroduction>
            </Section>
            <Paper>
                <NavigationTabs tabs={tabs} />
                <Divider />
                <Box sx={{ p: 2 }}>
                    {props.children}
                </Box>
            </Paper>
        </>
    );
}
