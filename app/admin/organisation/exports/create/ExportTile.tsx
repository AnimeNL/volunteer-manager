// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import ButtonBase from '@mui/material/ButtonBase';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { ServerActionDialog } from '@app/admin/components/ServerActionDialog';

/**
 * Recapitalises the given `label` to be lowercase, unless one of a known set of brands is included
 * in the pharsing.
 */
function recapitalise(label: string): string {
    const lowercaseLabel = label.toLowerCase();
    return lowercaseLabel.replaceAll('discord', 'Discord')
                         .replaceAll('whatsapp', 'WhatsApp');
}

/**
 * Props accepted by the <ExportTile> component.
 */
interface ExportTileProps {
    /**
     * Server action to execute when committing the export contained by this tile.
     */
    action: ServerAction;

    /**
     * Icon to display on the tile, identifying what will be exported.
     */
    icon: React.ReactNode;

    /**
     * Label to display on the tile.
     */
    label: string;

}

/**
 * The <ExportTile> component displays an individual export tile, representing a type of data that
 * can be exported to a third party. The export itself will be prepared in a dialog.
 */
export function ExportTile(props: React.PropsWithChildren<ExportTileProps>) {
    const [ dialogEverOpen, setDialogEverOpen ] = useState<boolean>(false);
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no dependencies */ ]);
    const handleDialogOpen = useCallback(() => {
        setDialogEverOpen(true);
        setDialogOpen(true);
    }, [ /* no dependencies */ ]);

    return (
        <>
            <ButtonBase focusRipple onClick={handleDialogOpen} sx={{
                '&:hover': {
                    backgroundColor: theme =>
                        theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)'
                                                      : 'rgba(0, 0, 0, 0.05)',
                },
                border: theme => `1px solid ${theme.palette.divider}`,
                borderRadius: theme => `${theme.shape.borderRadius}px`,
                padding: 2,
                width: '250px',
            }}>
                <Stack direction="column" alignItems="center" spacing={2}>
                    {props.icon}
                    <Typography variant="button">
                        {props.label}
                    </Typography>
                </Stack>
            </ButtonBase>
            { !!dialogEverOpen &&
                <ServerActionDialog action={props.action} submitLabel="Export"
                                    title={`Export ${recapitalise(props.label)}`}
                                    open={dialogOpen} onClose={handleDialogClose}>
                    <Alert severity="warning" sx={{ mt: -1, mb: 2 }}>
                        You're about to export {recapitalise(props.label)} information, possibly to
                        a third party. All data access will be logged for accountability.
                    </Alert>
                    <Grid container spacing={2}>
                        {props.children}
                    </Grid>
                </ServerActionDialog> }
        </>
    );
}
