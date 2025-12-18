// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';

import Grid from '@mui/material/Grid';

import { LineGraph } from './components/LineGraph';
import { StatisticsFilters } from './components/StatisticsFilters';
import { StatisticsSection } from './components/StatisticsSection';
import { determineFilters } from './Filters';

import { getAgeDistribution } from './queries/getAgeDistribution';
import { getApplicationStatus } from './queries/getApplicationStatus';
import { getAverageShiftsPerVolunteer } from './queries/getAverageShiftsPerVolunteer';
import { getGenderDistribution } from './queries/getGenderDistribution';
import { getNumberOfVolunteers } from './queries/getNumberOfVolunteers';
import { getRetention } from './queries/getRetention';

/**
 * Detailed descriptions of the KPIs displayed on the statistics overview page. Not everyone is well
 * vested in what the graph titles may mean, so
 */
const kDescriptions = {
    age:
        'This statistic describes the average age of volunteers across the selected teams. The ' +
        'average age of our visitors is in the low 20s, and while we expect volunteers to be a ' +
        'little bit older—many people won\'t help out in their first year, too large a ' +
        'difference could be a barrier for new volunteers to sign up.',

    application:
        'This statistic describes the status of received applications across the selected teams, ' +
        'indicating the acceptance, rejection and cancellation rates. This is not a KPI as much ' +
        'of this is outside of our control, although high cancellation rates should be ' +
        'considered as a cause for concern.',

    count:
        'This statistic describes the total number of volunteers within each of the teams, ' +
        'including Senior and Staff-level volunteers.',

    gender:
        'This statistic describes the gender balance in each of the teams. Our thesis is that ' +
        'balanced teams create for a more welcoming environment, where unbalanced teams ' +
        'discourage especially new volunteers from participating.',

    retention:
        'This statistic describes the percentage of volunteers who decided to participate again ' +
        'in the following event, or the event following that one. This means that retention for ' +
        '2023 would be considered at 50% if half the volunteers participated again in either ' +
        '2024 or 2025. Our thesis is that volunteers who are treated well and enjoy what they ' +
        'are doing are more likely to participate again.',

    shifts:
        'This statistic describes the average number of hours volunteers helped us out. We aim ' +
        'for about 12 hours of shifts for Crew and Hosts, and about 16 hours of shifts for ' +
        'Stewards, as they receive additional training. Senior and Staff-level volunteers are ' +
        'excluded, as are shifts such as the group photo.',

} as const;

/**
 * Root page of the statistics interface. While statistics are styled individually for each of the
 * environments, contents are the same across them. People with access to the statistics are able
 * to drill in to each one of them, across events and teams.
 */
export default async function StatisticsPage(params: PageProps<'/statistics'>) {
    // TODO: We probably need a toUrlSearchParams() utility function somewhere to make this stable.
    const searchParams = new URLSearchParams(await params.searchParams as any);

    const filters = await determineFilters(searchParams);
    if (!filters.access.basic)
        forbidden();

    return (
        <>
            <StatisticsFilters searchParams={searchParams} />
            <Grid container spacing={2}>
                <StatisticsSection title="Number of volunteers" description={kDescriptions.count}>
                    <LineGraph filters={filters} query={getNumberOfVolunteers} />
                </StatisticsSection>
                <StatisticsSection title="Shifts per volunteer (average)" kpi
                                   description={kDescriptions.shifts}>
                    <LineGraph filters={filters} query={getAverageShiftsPerVolunteer}
                               suffix="hours" />
                </StatisticsSection>
                <StatisticsSection title="Application status"
                                   description={kDescriptions.application}>
                    <LineGraph filters={filters} query={getApplicationStatus} percentage />
                </StatisticsSection>
                <StatisticsSection title="Retention" kpi description={kDescriptions.retention}>
                    <LineGraph filters={filters} query={getRetention} percentage />
                </StatisticsSection>
                <StatisticsSection title="Age distribution" description={kDescriptions.age}>
                    <LineGraph filters={filters} query={getAgeDistribution} suffix="years"/>
                </StatisticsSection>
                <StatisticsSection title="Gender distribution" kpi
                                   description={kDescriptions.gender}>
                    <LineGraph filters={filters} query={getGenderDistribution} percentage />
                </StatisticsSection>
            </Grid>
        </>
    );
}
