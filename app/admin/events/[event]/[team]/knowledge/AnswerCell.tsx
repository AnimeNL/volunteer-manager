// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import SourceOutlinedIcon from '@mui/icons-material/SourceOutlined';
import Tooltip from '@mui/material/Tooltip';

/**
 * Cell for the header of the answer quality column.
 */
export function AnswerHeader() {
    return (
        <Tooltip title="Has this question been answered?">
            <SourceOutlinedIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Cell for the value of an answer quality column, indicating to the user whether the Q&A is ready
 * to go, or whether it should be expanded for completeness.
 */
export function AnswerCell(props: { row: { contentLength?: number } }) {
    if (!props.row.contentLength || props.row.contentLength < 10) {
        return (
            <Tooltip title="An answer still needs to be written">
                <SourceOutlinedIcon fontSize="small" color="error" />
            </Tooltip>
        );
    } else if (props.row.contentLength < 80) {
        return (
            <Tooltip title="An answer exists, but is rather short">
                <SourceOutlinedIcon fontSize="small" color="warning" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="This question has been answered">
                <SourceOutlinedIcon fontSize="small" color="success" />
            </Tooltip>
        );
    }
}
