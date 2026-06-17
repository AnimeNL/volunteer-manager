// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { default as MuiLink } from '@mui/material/Link';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NavigateNextOutlinedIcon from '@mui/icons-material/NavigateNextOutlined';
import Typography from '@mui/material/Typography';

import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Dependencies that should be included in the dialog. Version information is sourced at build time.
 */
const kDependencies = [
    {
        name: 'MUI',
        url: 'https://mui.com/core/',
        version: process.env.NEXT_PUBLIC_VERSION_MUI,
    },
    {
        name: 'MUI X',
        url: 'https://mui.com/x/',
        version: process.env.NEXT_PUBLIC_VERSION_MUI_X,
    },
    {
        name: 'Next.js',
        url: 'https://nextjs.org/',
        version: process.env.NEXT_PUBLIC_VERSION_NEXTJS,
    },
    {
        name: 'React',
        url: 'https://react.dev/',
        version: process.env.NEXT_PUBLIC_VERSION_REACT,
    },
];

/**
 * Props accepted by the <AboutDialog>.
 */
interface AboutDialogProps {
    /**
     * Callback to invoke when the dialog should be closed.
     */
    onClose: () => void;

    /**
     * Whether the dialog should be presented.
     */
    open: boolean;
}

/**
 * The <AboutDialog> displays a dialog informing the user of the exact versions of the Volunteer
 * Manager, as well as key dependencies used in the project.
 */
export function AboutDialog(props: AboutDialogProps) {
    const buildDate = useMemo(() => {
        const instant = Temporal.Instant.from(process.env.NEXT_PUBLIC_PROJECT_BUILD_DATE!);
        const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());

        return formatDate(zonedDateTime, 'dddd MMMM Do[ at ]HH:mm');

    }, [ /* no dependencies */ ]);

    return (
        <Dialog open={props.open} onClose={props.onClose} fullWidth>
            <DialogTitle sx={{ pb: 0.5 }}>
                { process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION }
            </DialogTitle>
            <DialogContent sx={{ pb: 1 }}>
                <Typography variant="body2">
                    Version v{ process.env.NEXT_PUBLIC_PROJECT_VERSION }{' '}
                    ({ process.env.NEXT_PUBLIC_PROJECT_BUILD_HASH }) built on {buildDate} —{' '}
                    <MuiLink component={Link} href={ process.env.NEXT_PUBLIC_PROJECT_HOMEPAGE! }
                             target="_blank">
                        GitHub
                    </MuiLink>
                </Typography>
                <Divider sx={{ mt: 2 }} />
                <List dense sx={{ mx: -3 }}>
                    { kDependencies.map((dependency, index) =>
                        <ListItemButton key={index} LinkComponent={Link} href={dependency.url}
                                        target="_blank" sx={{ px: 3 }}>
                            <ListItemIcon>
                                <AccountTreeOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={dependency.name} />
                            <Typography variant="body2" color="textDisabled">
                                v{dependency.version}
                            </Typography>
                            <NavigateNextOutlinedIcon color="action" />
                        </ListItemButton> ) }
                </List>
                <Divider />
            </DialogContent>
            <DialogActions sx={{ pt: 0, mr: 2, mb: 0 }}>
                <Button onClick={props.onClose} variant="text">Close</Button>
            </DialogActions>
        </Dialog>
    );
}
