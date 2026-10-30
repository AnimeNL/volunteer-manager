// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import type { RemoteGraphFnReturn } from './RemoteGraphFn';
import { RemoteGraph } from './RemoteGraph';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Props accepted by the <RemoteGraphDialog> component.
 */
interface RemoteGraphDialogProps {
    /**
     * Optional description to show under the chart's title.
     */
    description?: string;

    /**
     * Server action through which the data associated with the remote graph can be obtained.
     */
    fetchDataFn: (cumulative: boolean) => Promise<RemoteGraphFnReturn>;

    /**
     * Callback to invoke when the dialog should be closed.
     */
    onClose?: () => void;

    /**
     * Title of the dialog, to show in the user interface.
     */
    title: string;
}

/**
 * The <RemoteGraphDialog> component displays a dialog for a remote graph. The function used to
 * fetch the data must be made available as a Server Action passed in a prop.
 */
export function RemoteGraphDialog(props: RemoteGraphDialogProps) {
    const [ cumulative, setCumulative ] = useState<boolean>(true);

    const handleChangeCumulative = useCallback(() => setCumulative(v => !v), [ /* no deps */ ]);

    const title = (
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="inherit">
                {props.title}
            </Typography>
            <FormControlLabel value="cumulative"
                              control={
                                  <Switch checked={cumulative} color="primary"
                                          onChange={handleChangeCumulative} /> }
                              label="Cumulative"
                              labelPlacement="start"
                              slotProps={{ typography: { variant: 'caption' } }} />
        </Stack>
    );

    return (
        <ResponsiveDialog open onClose={props.onClose} title={title}
                          description={props.description}>
            <RemoteGraph cumulative={cumulative} fetchDataFn={props.fetchDataFn} />
        </ResponsiveDialog>
    );
}
