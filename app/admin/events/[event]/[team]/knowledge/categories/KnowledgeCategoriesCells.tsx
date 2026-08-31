// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CatchingPokemonIcon from '@mui/icons-material/CatchingPokemon';
import Tooltip from '@mui/material/Tooltip';

import { KnowledgeBaseIcon } from '@components/KnowledgeBaseIcon';

/**
 * Header component for the category icon column.
 */
export function CategoryIconHeader() {
    return (
        <Tooltip title="Icon used for this category">
            <CatchingPokemonIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Cell component for the category icon column.
 */
export function CategoryIconCell(props: { row: { icon?: string } }) {
    return (
        <KnowledgeBaseIcon variant={props.row.icon ?? 'HelpOutline'} fontSize="small"
                           color="primary" />
    );
}
