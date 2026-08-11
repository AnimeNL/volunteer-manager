// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import Tooltip from '@mui/material/Tooltip';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

/**
 * Component that heads the column indicating whether the messages will be visible.
 */
export function VisibilityHeaderCell() {
    return (
        <Tooltip title="Should messages be shown in system logs?">
            <VisibilityOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Component to indicate whether messages will be visible.
 */
export function VisibilityCell(props: { row: { visible: boolean } }) {
    if (props.row.visible) {
        return (
            <Tooltip title="Messages are shown in system logs">
                <VisibilityOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Messages are hidden from system logs">
                <VisibilityOffOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }
}

/**
 * Component that heads the column indicating whether the messages are still being recorded.
 */
export function RecordingHeaderCell() {
    return (
        <Tooltip title="Are messages still being recorded?">
            <CircleOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Component to indicate whether messages are still being recorded.
 */
export function RecordingCell(props: { row: { active: boolean } }) {
    if (props.row.active) {
        return (
            <Tooltip title="Message type is still functional">
                <PlayCircleOutlineOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Message type has been deprecated">
                <PauseCircleOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }
}
