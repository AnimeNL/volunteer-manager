// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HistoryIcon from '@mui/icons-material/History';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import Link from '@app/LinkProxy';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';

/**
 * Props accepted by the <HistoryIconButton> component.
 */
interface HistoryIconButtonProps {
    /**
     * Target URL for navigation when clicked.
     */
    href: string;
}

/**
 * Displays an icon button that links to a preference history page.
 */
export function HistoryIconButton(props: HistoryIconButtonProps) {
    return (
        <IconButton LinkComponent={Link} href={props.href} size="small">
            <Tooltip title="Change history…">
                <TooltipIconWrapper>
                    <HistoryIcon color="info" fontSize="small" />
                </TooltipIconWrapper>
            </Tooltip>
        </IconButton>
    );
}
