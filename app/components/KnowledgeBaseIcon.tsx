// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React from 'react';

import type SvgIcon from '@mui/material/SvgIcon';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AccessibleIcon from '@mui/icons-material/Accessible';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import EuroIcon from '@mui/icons-material/Euro';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GavelIcon from '@mui/icons-material/Gavel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import MapIcon from '@mui/icons-material/Map';
import RamenDiningIcon from '@mui/icons-material/RamenDining';
import SecurityIcon from '@mui/icons-material/Security';
import WhatshotIcon from '@mui/icons-material/Whatshot';

/**
 * Icons known to the knowledge base. It's safe to add or remove entries from this object.
 */
export const kKnowledgeBaseIconTable: { [k: string]: typeof SvgIcon } = {
    Accessibility: AccessibleIcon,
    Children: ChildCareIcon,
    Contact: AlternateEmailIcon,
    Event: EventNoteIcon,
    Food: RamenDiningIcon,
    Money: EuroIcon,
    Neighbourhood: MapIcon,
    Rules: GavelIcon,
    Security: SecurityIcon,
    Senior: WhatshotIcon,
    Taxi: AirportShuttleIcon,
    Tickets: LocalActivityIcon,
    Time: AccessTimeIcon,
    Venue: LocationCityIcon,

    // Do not change the following icon, as it's the fallback:
    Unknown: HelpOutlineIcon,
};

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
