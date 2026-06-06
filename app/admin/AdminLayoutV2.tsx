// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Typography from '@mui/material/Typography';

import { AdminLayoutThemeV2 } from './AdminLayoutThemeV2';
import { AdminMenu, AdminPageWrapper } from './AdminLayoutClientV2';
import { NavigationSidebar } from './layout/NavigationSidebar';

/**
 * Root component of the new administration layout, which is a substantial step up from the original
 * Material UI-inspired design. Responsive and expressive from the get-go.
 */
export async function AdminLayoutV2(props: React.PropsWithChildren) {
    return (
        <AdminLayoutThemeV2>
            <AdminPageWrapper direction="row" spacing={2}>
                <NavigationSidebar />
                <AdminMenu>
                    <Typography>
                        Administration menu
                    </Typography>
                </AdminMenu>
                {props.children}
            </AdminPageWrapper>
        </AdminLayoutThemeV2>
    );
}
