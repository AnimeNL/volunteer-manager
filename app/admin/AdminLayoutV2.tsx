// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import IconButton from '@mui/material/IconButton';
import ScienceIcon from '@mui/icons-material/Science';
import SettingsIcon from '@mui/icons-material/Settings';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { AdminLayoutThemeV2 } from './AdminLayoutThemeV2';
import { AdminMenu, AdminPageWrapper, AdminSectionStack } from './AdminLayoutClientV2';

/**
 * Root component of the new administration layout, which is a substantial step up from the original
 * Material UI-inspired design. Responsive and expressive from the get-go.
 */
export function AdminLayoutV2(props: React.PropsWithChildren) {
    return (
        <AdminLayoutThemeV2>
            <AdminPageWrapper direction="row" spacing={2}>
                <AdminSectionStack>
                    <IconButton LinkComponent={Link} href="/admin">
                        <Tooltip placement="right" title="Dashboard">
                            <DashboardIcon htmlColor="white" />
                        </Tooltip>
                    </IconButton>
                    <IconButton LinkComponent={Link} href="/admin/events">
                        <Tooltip placement="right" title="Events">
                            <EventIcon htmlColor="#fafafa" />
                        </Tooltip>
                    </IconButton>
                    <IconButton LinkComponent={Link} href="/admin/organisation">
                        <Tooltip placement="right" title="Organisation">
                            <AccountBalanceIcon htmlColor="#fafafa" />
                        </Tooltip>
                    </IconButton>
                    <IconButton sx={{ marginTop: 'auto' }}>
                        <Tooltip placement="right" title="Experiments">
                            <ScienceIcon color="error" />
                        </Tooltip>
                    </IconButton>
                    <IconButton>
                        <Tooltip placement="right" title="Settings">
                            <SettingsIcon color="error" />
                        </Tooltip>
                    </IconButton>
                </AdminSectionStack>
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
