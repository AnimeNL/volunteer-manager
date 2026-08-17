// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';

import HistoryIcon from '@mui/icons-material/History';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

/**
 * Props accepted by the <HistoryIconButton> component.
 */
interface HistoryIconButtonProps {
    /**
     * URL that the icon button should link to.
     */
    href: string;
}

/**
 * The <HistoryIconButton> displays an icon that, when clicked, navigates to the history page.
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
