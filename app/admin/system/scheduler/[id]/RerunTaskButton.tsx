// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import RepeatIcon from '@mui/icons-material/Repeat';
import Tooltip from '@mui/material/Tooltip';

import { rerunSchedulerTask } from '../SchedulerActions';

/**
 * Props accepted by the <RerunTaskButton> component.
 */
interface RerunTaskButtonProps {
    /**
     * Unique ID of the task that should be re-run when queried.
     */
    taskId: number;
}

/**
 * The <RerunTaskButton> component allows an administrator to re-run a task that has already
 * finished executing, to manually try again in case something went wrong.
 */
export function RerunTaskButton(props: RerunTaskButtonProps) {
    const router = useRouter();

    const [ childTaskId, setChildTaskId ] = useState<number | undefined>();
    const [ disabled, setDisabled ] = useState<boolean>(false);
    const [ error, setError ] = useState<boolean>(false);

    const [ loading, setLoading ] = useState<boolean>(false);

    const handleNavigate = useCallback(() => {
        if (!!childTaskId)
            router.push(`./${childTaskId}`);
    }, [ childTaskId, router ]);

    const handleRetry = useCallback(async () => {
        setChildTaskId(undefined);
        setDisabled(false);
        setLoading(true);
        try {
            const result = await rerunSchedulerTask({
                taskId: props.taskId,
            });

            if (!!result.success) {
                setChildTaskId(result.taskId);
                setDisabled(true);
            } else {
                setError(true);
            }
        } catch (error: any) {
            console.error(error);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [ props.taskId ]);

    return (
        <>
            <Tooltip title="Re-run this task">
                <Button size="small" disabled={disabled} loading={loading} variant="outlined"
                        color={ error ? 'error' : 'primary' } onClick={handleRetry}>
                    <RepeatIcon fontSize="small" />
                </Button>
            </Tooltip>
            <Collapse in={!!childTaskId} orientation="horizontal">
                <Tooltip title="Navigate to the child task">
                    <Button size="small" variant="outlined" color="success"
                            onClick={handleNavigate}>
                        <KeyboardDoubleArrowRightIcon fontSize="small" />
                    </Button>
                </Tooltip>
            </Collapse>
        </>
    );
}
