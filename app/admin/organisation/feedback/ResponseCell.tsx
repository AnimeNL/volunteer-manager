// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import Tooltip from '@mui/material/Tooltip';

import { kFeedbackResponse, type FeedbackResponse } from '@lib/database/Types';

/**
 * Header to display in the response column to indicate what it's about.
 */
export function ResponseHeader() {
    return (
        <Tooltip title="Have we responded to the feedback?">
            <ThumbUpOffAltIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Renders the custom response column cells.
 */
export function ResponseCell({ row }: { row: { response?: FeedbackResponse } }) {
    switch (row.response) {
        case kFeedbackResponse.Acknowledged:
            return (
                <Tooltip title="The feedback has been acknowledged">
                    <MoreHorizIcon color="success" fontSize="small" />
                </Tooltip>
            );

        case kFeedbackResponse.Archived:
            return (
                <Tooltip title="The feedback is archived">
                    <MoreHorizIcon color="disabled" fontSize="small" />
                </Tooltip>
            );

        case kFeedbackResponse.Declined:
            return (
                <Tooltip title="Feedback has been declined">
                    <ThumbDownOffAltIcon color="error" fontSize="small" />
                </Tooltip>
            );

        case kFeedbackResponse.Resolved:
            return (
                <Tooltip title="Feedback has been resolved">
                    <ThumbUpOffAltIcon color="success" fontSize="small" />
                </Tooltip>
            );
    }

    return (
        <Tooltip title="The feedback is pending">
            <MoreHorizIcon color="warning" fontSize="small" />
        </Tooltip>
    );
}
