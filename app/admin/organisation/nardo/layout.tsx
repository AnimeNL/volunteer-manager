// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import GroupsIcon from '@mui/icons-material/Groups';
import Paper from '@mui/material/Paper';
import RecommendIcon from '@mui/icons-material/Recommend';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';

import { NavigationTabs, type NavigationTabsProps } from '@app/admin/components/NavigationTabs';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <NardoLayout> is the layout wrapper that provides navigation for the Del a Rie Advies section
 * of the Volunteer Manager. A couple of tabs are included.
 */
export default async function NardoLayout(props: LayoutProps<'/admin/organisation/nardo'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.nardo',
    });

    // ---------------------------------------------------------------------------------------------
    // Determine the tabs that the signed in user has access to
    // ---------------------------------------------------------------------------------------------

    const tabs: NavigationTabsProps['tabs'] = [
        {
            icon: <TipsAndUpdatesIcon />,
            label: 'Advice',
            url: '/admin/organisation/nardo',
            urlMatchMode: 'strict',
        },
        {
            icon: <RecommendIcon />,
            label: 'Personalised advice',
            url: '/admin/organisation/nardo/personalised',
            urlMatchMode: 'prefix',
        },
    ];

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Section icon={ <GroupsIcon color="primary" /> } title="Del a Rie Advies">
                <SectionIntroduction>
                    This is the exclusive repertoire demonstrating the best of what <strong>Del a
                    Rie Advies</strong> has to offer, including issued personalised advice. Please
                    be concious of the diverse nature of our audience and keep it somewhat
                    reasonable.
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
