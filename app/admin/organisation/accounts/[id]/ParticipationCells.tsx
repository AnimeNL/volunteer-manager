// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Chip } from '@app/admin/components/Chip';

/**
 * Props accepted by the <TeamCell> component.
 */
interface TeamCellProps {
    row: {
        team: string;
        teamColour: string;
    };
}

/**
 * Cell to display the team chip with its configured theme color.
 */
export function TeamCell(props: TeamCellProps) {
    return <Chip color={props.row.teamColour} label={props.row.team} />;
}
