// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import BookIcon from '@mui/icons-material/Book';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import GroupIcon from '@mui/icons-material/Group';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import InfoIcon from '@mui/icons-material/Info';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import NotListedLocationIcon from '@mui/icons-material/NotListedLocation';
import NotListedLocationOutlinedIcon from '@mui/icons-material/NotListedLocationOutlined';

import type { NavigationData } from '../lib/navigationTypes';
import type { NavigationSubItem } from './NavigationItem';
import { ExpandableNavigationSection, NavigationLink,
    createNavigationSubItem } from './NavigationItem';
import { getSchedulePath, isNavigationPathActive } from '../lib/navigationTypes';

/**
 * Props accepted by the <SecondaryNavigationItems> component.
 */
interface SecondaryNavigationItemsProps {
    data: NavigationData;
    onNavigate?: () => void;
    relativePathname: string;
}

/**
 * Renders the secondary schedule routes (Duty book, Help requests, Knowledge base, and Volunteers)
 * shared between the desktop sidebar and mobile More bottom sheet.
 */
export function SecondaryNavigationItems(props: SecondaryNavigationItemsProps) {
    const { data, onNavigate, relativePathname } = props;
    const { dutyBooks, eventSlug, hasHelpRequests, hasKnowledgeBase, volunteerTeams } = data;

    const hasMultipleDutyBooks = dutyBooks.length > 1;
    const isDutyBookActive = hasMultipleDutyBooks
        ? relativePathname === '/duty-book'
        : isNavigationPathActive(relativePathname, '/duty-book');
    const dutyBookHref = hasMultipleDutyBooks
        ? getSchedulePath(eventSlug, '/duty-book')
        : getSchedulePath(eventSlug, `/duty-book/${dutyBooks[0]?.team}`);

    const dutyBookItems: NavigationSubItem[] = hasMultipleDutyBooks
        ? dutyBooks.map(entry =>
            createNavigationSubItem(
                eventSlug, relativePathname, `/duty-book/${entry.team}`, entry.team, entry.name))
        : [];

    const hasMultipleVolunteerTeams = volunteerTeams.length > 1;
    const isVolunteersActive = hasMultipleVolunteerTeams
        ? relativePathname === '/volunteers'
        : isNavigationPathActive(relativePathname, '/volunteers');
    const volunteerTeamItems: NavigationSubItem[] = hasMultipleVolunteerTeams
        ? volunteerTeams.map(team =>
            createNavigationSubItem(
                eventSlug, relativePathname, `/volunteers/teams/${team.slug}`, team.slug,
                team.name))
        : [];

    const secondaryLinks = [
        {
            activeIcon: <NotListedLocationIcon fontSize="small" />,
            icon: <NotListedLocationOutlinedIcon fontSize="small" />,
            label: 'Help requests',
            segment: '/help-requests',
            visible: hasHelpRequests,
        },
        {
            activeIcon: <InfoIcon fontSize="small" />,
            icon: <InfoOutlinedIcon fontSize="small" />,
            label: 'Knowledge base',
            segment: '/knowledge',
            visible: hasKnowledgeBase,
        },
    ];

    return (
        <>
            { dutyBooks.length > 0 &&
                <ExpandableNavigationSection
                    activeIcon={ <BookIcon fontSize="small" /> }
                    defaultExpanded={data.expandDutyBook}
                    expandLabel="duty books"
                    href={dutyBookHref}
                    icon={ <BookOutlinedIcon fontSize="small" /> }
                    items={dutyBookItems}
                    label="Duty book"
                    onNavigate={onNavigate}
                    sectionId="duty-book"
                    selected={isDutyBookActive} /> }

            { secondaryLinks.filter(link => link.visible).map(link => (
                <NavigationLink
                    key={link.segment}
                    activeIcon={link.activeIcon}
                    href={getSchedulePath(eventSlug, link.segment)}
                    icon={link.icon}
                    label={link.label}
                    onClick={onNavigate}
                    selected={isNavigationPathActive(relativePathname, link.segment)} />
            )) }

            <ExpandableNavigationSection
                activeIcon={ <GroupIcon fontSize="small" /> }
                defaultExpanded={data.expandVolunteers}
                expandLabel="volunteer teams"
                href={getSchedulePath(eventSlug, '/volunteers')}
                icon={ <GroupOutlinedIcon fontSize="small" /> }
                items={volunteerTeamItems}
                label="Volunteers"
                onNavigate={onNavigate}
                sectionId="volunteers"
                selected={isVolunteersActive} />
        </>
    );
}
