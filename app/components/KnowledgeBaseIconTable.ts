// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type SvgIcon from '@mui/material/SvgIcon';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AccessibleIcon from '@mui/icons-material/Accessible';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import EuroIcon from '@mui/icons-material/Euro';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GavelIcon from '@mui/icons-material/Gavel';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import MapIcon from '@mui/icons-material/Map';
import PeopleIcon from '@mui/icons-material/People';
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
    People: PeopleIcon,
    Rules: GavelIcon,
    Security: SecurityIcon,
    Senior: WhatshotIcon,
    Taxi: AirportShuttleIcon,
    Tickets: LocalActivityIcon,
    Time: AccessTimeIcon,
    Venue: LocationCityIcon,

    // Do not change the following icon, as it's the fallback:
    Unknown: HelpOutlinedIcon,
};
