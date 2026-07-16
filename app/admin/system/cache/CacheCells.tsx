// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MemoryIcon from '@mui/icons-material/Memory';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import Tooltip from '@mui/material/Tooltip';

/**
 * Header component for the cache type column.
 */
export function CacheTypeHeader() {
    return (
        <Tooltip title="Cache type">
            <InfoOutlinedIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Props accepted by the <CacheTypeCell> component.
 */
interface CacheTypeCellProps {
    row: {
        type: 'permanent' | 'ttl' | 'lru' | string;
    };
}

/**
 * Component to display a cache type icon with tooltip.
 */
export function CacheTypeCell({ row }: CacheTypeCellProps) {
    switch (row.type) {
        case 'permanent':
            return (
                <Tooltip title="Permanent cache">
                    <AllInclusiveIcon fontSize="small" color="success" />
                </Tooltip>
            );
        case 'ttl':
            return (
                <Tooltip title="TTL cache">
                    <AccessTimeIcon fontSize="small" color="info" />
                </Tooltip>
            );
        case 'lru':
            return (
                <Tooltip title="LRU cache">
                    <MemoryIcon fontSize="small" color="warning" />
                </Tooltip>
            );
        default:
            return (
                <Tooltip title={`Unknown cache type: ${row.type}`}>
                    <QuestionMarkIcon fontSize="small" color="disabled" />
                </Tooltip>
            );
    }
}
