// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useState } from 'react';

import Button from '@mui/material/Button';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import Typography from '@mui/material/Typography';

import type { ServerAction, ServerActionResult } from '@lib/serverAction';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Cache to ensure that we only call the Server Action once per five minutes per account.
 */
const kActionCache = new Map<number, { promise: Promise<ServerActionResult>; timestamp: number }>();

/**
 * Props accepted by the <ConnectionCheck> component.
 */
interface ConnectionCheckProps {
    /**
     * E-mail addresses that exist in the system.
     */
    accounts: { id: number; address: string; }[];

    /**
     * Server Action through which a connection check can be executed.
     */
    action: ServerAction<{ accountId: number; }>;
}

/**
 * The <ConnectionCheck> component exposes a button that, once pressed, will run health checks for
 * all e-mail addresses known to the system. This will log in to the SMTP servers, but won't lead to
 * any actual messages being distrbuted.
 */
export function ConnectionCheck(props: ConnectionCheckProps) {
    const [ checking, setChecking ] = useState<boolean>(false);

    const handleCheck = useCallback(() => setChecking(true), [ ]);

    return (
        <>
            <Collapse in={!!checking} mountOnEnter>
                { !!checking &&
                    <List dense disablePadding>
                        { props.accounts.map((account, index) =>
                            <ConnectionCheckAccount
                                key={account.id} account={account} action={props.action}
                                divider={ index < (props.accounts.length - 1) } /> )}
                    </List> }
            </Collapse>
            <Collapse in={!checking} unmountOnExit>
                <Button onClick={handleCheck} size="small" variant="contained"
                        startIcon={ <PlayArrowIcon /> }>
                    Run connection check
                </Button>
            </Collapse>

        </>
    );
}

/**
 * Props accepted by the <ConnectionCheckAccount> component.
 */
interface ConnectionCheckAccountProps {
    /**
     * E-mail address that exist in the system.
     */
    account: ConnectionCheckProps['accounts'][number];

    /**
     * Server Action through which a connection check can be executed.
     */
    action: ServerAction<{ accountId: number; }>;

    /**
     * Whether a divider should be rendered under this account.
     */
    divider?: boolean;
}

/**
 * Component that runs the actual connection check. All checks will be ran in parallel.
 */
function ConnectionCheckAccount(props: ConnectionCheckAccountProps) {
    const [ resultStarted, setResultStarted ] = useState<boolean>(false);
    const [ result, setResult ] = useState<boolean | undefined>();

    const [ logDialogOpen, setLogDialogOpen ] = useState<boolean>(false);
    const [ log, setLog ] = useState<string | undefined>();

    useEffect(() => {
        if (resultStarted !== false)
            return;

        setResultStarted(true);
        async function runConnectionCheck() {
            let connectionCheckOutput: ServerActionResult;
            try {
                let connectionCheckOutputPromise: Promise<ServerActionResult>;

                const cached = kActionCache.get(props.account.id);
                if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) {
                    connectionCheckOutputPromise = cached.promise;
                } else {
                    connectionCheckOutputPromise = props.action({ accountId: props.account.id });
                    kActionCache.set(props.account.id, {
                        promise: connectionCheckOutputPromise,
                        timestamp: Date.now(),
                    });
                }

                connectionCheckOutput = await connectionCheckOutputPromise;
                setResult(connectionCheckOutput.success);

            } catch (error: any) {
                connectionCheckOutput = error.message;
                setResult(false);

            } finally {
                setLog(JSON.stringify(connectionCheckOutput!, null, 2));
            }
        }

        runConnectionCheck();

    }, [ props.account.id, props.action, resultStarted ]);

    const handleDialogClose = useCallback(() => setLogDialogOpen(false), [ ]);
    const handleDialogOpen = useCallback(() => setLogDialogOpen(true), [ ]);

    return (
        <ListItem disableGutters divider={props.divider}>
            <ListItemIcon>
                { result === undefined &&
                    <CircularProgress color="warning" size={20} sx={{ ml: 0.25 }} /> }
                { result === true && <CheckCircleOutlinedIcon color="success" /> }
                { result === false && <CancelOutlinedIcon color="error" /> }
            </ListItemIcon>
            <ListItemText primary={props.account.address} />
            <Collapse in={ result !== undefined } orientation="horizontal">
                <Button startIcon={ <QueryStatsIcon />} size="small" variant="outlined"
                        color={ result ? 'success' : 'error' } onClick={handleDialogOpen}>
                    Logs
                </Button>
            </Collapse>
            <ResponsiveDialog open={logDialogOpen} onClose={handleDialogClose}
                              title="Connection logs">
                <Typography variant="body2" sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                }}>
                    {log}
                </Typography>
            </ResponsiveDialog>
        </ListItem>
    );
}