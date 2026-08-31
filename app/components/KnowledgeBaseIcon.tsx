// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React from 'react';

import type { SvgIconProps } from '@mui/material/SvgIcon';

import { kKnowledgeBaseIconTable } from './KnowledgeBaseIconTable';

/**
 * Props accepted by the <KnowledgeBaseIcon> component.
 */
interface KnowledgeBaseIconProps extends SvgIconProps {
    /**
     * Variant of the icon to display.
     */
    variant: string;
}

/**
 * The <KnowledgeBaseIcon> component displays an icon associated with a particular knowledge base
 * category, indicated by the `variant`. A default icon will be used when the `variant` is invalid.
 */
export function KnowledgeBaseIcon(props: KnowledgeBaseIconProps) {
    const { variant, ...svgIconProps } = props;
    const element =
        kKnowledgeBaseIconTable.hasOwnProperty(variant) ? kKnowledgeBaseIconTable[variant]
                                                        : kKnowledgeBaseIconTable.Unknown;

    return React.createElement(element, svgIconProps);
}
