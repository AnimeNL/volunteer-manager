// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import EventIcon from '@mui/icons-material/Event';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MapsHomeWorkIcon from '@mui/icons-material/MapsHomeWork';
import Popover from '@mui/material/Popover';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import { styled } from '@mui/material/styles';

import type { PublicSchedule } from '@app/api/event/schedule/PublicSchedule';
import { Alert } from './Alert';
import { Avatar } from '@components/Avatar';
import { ScheduleContext } from '../ScheduleContext';
import { normalizeString, stringScoreEx } from '@lib/StringScore';

import { kEnforceSingleLine } from '../Constants';

/**
 * CSS customizations applied to the <EventListItem> component.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: theme => ({
        width: `calc(100vw - ${theme.spacing(16)})`,
        [theme.breakpoints.up('md')]: {
            width: '50vw',
        },

        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
    }),
};

/**
 * Specialization of <ListItemIcon> where the containing icon will be centered, rather than start-
 * aligned. This enables it to look consistent when shown together with avatars.
 */
const ListItemCenteredIcon = styled(ListItemIcon)(({ theme }) => ({
    paddingLeft: theme.spacing(.5),
}));

/**
 * Interface describing an individual search result.
 */
interface SearchResult {
    /**
     * Type of search result to display.
     */
    type: 'activity' | 'area' | 'knowledge' | 'location' | 'volunteer';

    /**
     * The avatar to display at the start of the search result, if any. When given, this should be
     * a URL to the image resource that represents this result.
     */
    avatar?: string;

    /**
     * URL that the user should be routed to when they click on this search result. Required.
     */
    href: string;

    /**
     * Label that represents the search result. Required.
     */
    label: string;

    /**
     * The search result's score. We use a string scoring algorithm that issues a score between 0
     * and 1, however, search type bonuses may lead to scores beyond 1.
     */
    score: number;
}

/**
 * Different types of search results are prioritized differently, based on the likelihood of a user
 * searching for that sort of content combined with the assumed volume of possible results within.
 */
const kSearchScoreTypeBonus: { [K in SearchResult['type']]: number } = {
    activity: 0,
    area: 0.1,
    knowledge: 0.05,
    location: 0.1,
    volunteer: 0.075,
};

/**
 * Searches the |event| for the given |query|, and returns the results, if any.
//
// In the first stage, we iterate through all of the areas, events, locations and volunteers, and
// apply a string similarity score using Joshaven Potter's string score library. A minor amount of
// fuzzing is allowed, in order to correct for the most obvious of typos.
//
// Different entity types get a different score "bonus" applied to them. This bonus is decided based
// on the relative importance and likelihood of people searching for it. Volunteers are assumed to
// be more interested in Joe, a fellow volunteer, than the "Joe Painting" session during the event.
//
// The returned array of search results will be sorted by priority, based on returning no more than
// |limit| results. The |limit|ing is particularly useful for the inline search functionality.
 */
function Search(schedule: PublicSchedule, query: string, limit: number) {
    const scheduleBaseUrl = `/schedule/${schedule.slug}`;

    const normalisedQuery = normalizeString(query);
    const results: SearchResult[] = [];

    // ---------------------------------------------------------------------------------------------
    // Step 1: Iterate through the |schedule| to identify candidates
    // ---------------------------------------------------------------------------------------------

    for (const activity of Object.values(schedule.program.activities)) {
        const score = stringScoreEx(
            activity.title, query, normalisedQuery, schedule.config.searchResultFuzziness);

        if (score >= schedule.config.searchResultMinimumScore) {
            results.push({
                type: 'activity',
                href: `${scheduleBaseUrl}/events/${activity.id}`,
                label: activity.title,
                score: score + kSearchScoreTypeBonus.activity,
            });
        }
    }

    for (const area of Object.values(schedule.program.areas)) {
        const score = stringScoreEx(
            area.name, query, normalisedQuery, schedule.config.searchResultFuzziness);

        if (score >= schedule.config.searchResultMinimumScore) {
            results.push({
                type: 'area',
                href: `${scheduleBaseUrl}/areas/${area.id}`,
                label: area.name,
                score: score + kSearchScoreTypeBonus.area,
            });
        }
    }

    if (schedule.config.enableKnowledgeBaseSearch) {
        for (const category of schedule.knowledge) {
            for (const [ question, id ] of Object.entries(category.questions)) {
                const score = stringScoreEx(
                    question, query, normalisedQuery, schedule.config.searchResultFuzziness);

                if (score >= schedule.config.searchResultMinimumScore) {
                    results.push({
                        type: 'knowledge',
                        href: `${scheduleBaseUrl}/knowledge/${category.id}?q=${id}#${id}`,
                        label: question,
                        score: score + kSearchScoreTypeBonus.knowledge,
                    });
                }
            }
        }
    }

    for (const location of Object.values(schedule.program.locations)) {
        const score = stringScoreEx(
            location.name, query, normalisedQuery, schedule.config.searchResultFuzziness);

        if (score >= schedule.config.searchResultMinimumScore) {
            results.push({
                type: 'location',
                href: `${scheduleBaseUrl}/locations/${location.id}`,
                label: location.name,
                score: score + kSearchScoreTypeBonus.location,
            });
        }
    }

    for (const volunteer of Object.values(schedule.volunteers)) {
        const score = stringScoreEx(
            volunteer.name, query, normalisedQuery, schedule.config.searchResultFuzziness);

        if (score >= schedule.config.searchResultMinimumScore) {
            results.push({
                type: 'volunteer',
                href: `${scheduleBaseUrl}/volunteers/${volunteer.id}`,
                label: volunteer.name,
                score: score + kSearchScoreTypeBonus.volunteer,
                avatar: volunteer.avatar,
            });
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Step 2: Sort the |results| in descending order based on the score they have been assigned by
    //         the string comparison algorithm. Then limit the return value to the result limits.
    // ---------------------------------------------------------------------------------------------

    results.sort((lhs, rhs) => {
        if (lhs.score === rhs.score)
            return 0;

        return lhs.score > rhs.score ? -1 : 1;
    });

    return results.slice(0, limit);
}

/**
 * Props accepted by the <SearchResults> component.
 */
interface SearchResultsProps {
    /**
     * The element to which the search results should be anchored. Can be undefined when the search
     * bar element hasn't been mounted to the DOM yet.
     */
    anchorEl?: Element;

    /**
     * Whether to commit to the first search result. The popover will be closed automatically after.
     */
    commit?: boolean;

    /**
     * Event that will be triggered when the <SearchResults> component should close.
     */
    onClose: () => void;

    /**
     * The search query for which results should be shown. The component will not display anything
     * when no query has been passed.
     */
    query?: string;
}

/**
 * The <SearchResults> component doesn't just identify the search results, but also lists the
 * results in a way that works well for the user.
 */
export function SearchResults(props: SearchResultsProps) {
    const { anchorEl, commit, onClose, query } = props;

    const { schedule } = useContext(ScheduleContext);
    const router = useRouter();

    const results = useMemo(() => {
        if (!query || !query.length || !schedule)
            return [ /* no results */ ];

        return Search(schedule, query, schedule.config.searchResultLimit);

    }, [ schedule, query ]);

    // Called when a search result has been committed and the user should be navigated to the given
    // `url`. The search bar will automatically close consistently with the user expectations.
    const handleCommit = useCallback((url: string) => {
        router.push(url);
        onClose();

    }, [ onClose, router ]);

    // When `commit` is set to true, the top search result (if any) will be committed as if the user
    // clicked on it. The search view will be closed immediately.
    if (commit) {
        if (results.length > 0)
            router.push(results[0].href);

        onClose();
        return undefined;
    }

    if (!anchorEl || !schedule || !query)
        return undefined;

    return (
        <Popover anchorEl={anchorEl}
                 anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
                 transformOrigin={{ horizontal: 'center', vertical: 'top' }}
                 slotProps={{ paper: { sx: kStyles.container } }}
                 disableAutoFocus disableEnforceFocus
                 elevation={4} open={true}
                 onClose={onClose}>

            { !results.length &&
                <Alert severity="warning">
                    No search results could be found
                </Alert> }

            { !!results.length &&
                <List disablePadding>
                    { results.map(result => {
                        let avatar: React.ReactNode;
                        switch (result.type) {
                            case 'activity':
                                avatar = (
                                    <ListItemCenteredIcon>
                                        <EventIcon color="primary" />
                                    </ListItemCenteredIcon>
                                );
                                break;

                            case 'area':
                                avatar = (
                                    <ListItemCenteredIcon>
                                        <MapsHomeWorkIcon color="primary" />
                                    </ListItemCenteredIcon>
                                );
                                break;

                            case 'knowledge':
                                avatar = (
                                    <ListItemCenteredIcon>
                                        <HelpOutlineIcon color="primary" />
                                    </ListItemCenteredIcon>
                                );
                                break;

                            case 'location':
                                avatar = (
                                    <ListItemCenteredIcon>
                                        <ReadMoreIcon color="primary" />
                                    </ListItemCenteredIcon>
                                );
                                break;

                            case 'volunteer':
                                avatar = (
                                    <ListItemCenteredIcon>
                                        <Avatar size="small" src={result.avatar}>
                                            {result.label}
                                        </Avatar>
                                    </ListItemCenteredIcon>
                                );
                                break;

                            default:
                                throw new Error(`Unrecognised result type: ${result.type}`);
                        }

                        return (
                            <ListItemButton key={result.href}
                                            onClick={ () => handleCommit(result.href) }>
                                {avatar}
                                <ListItemText primaryTypographyProps={{ sx: kEnforceSingleLine }}
                                              primary={result.label} />
                            </ListItemButton>
                        );
                    }) }
                </List> }

        </Popover>
    );
}
