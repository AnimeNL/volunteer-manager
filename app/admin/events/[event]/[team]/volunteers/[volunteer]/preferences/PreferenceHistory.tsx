// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import TopicOutlinedIcon from '@mui/icons-material/TopicOutlined';

import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { FormGrid } from '@app/admin/components/FormGrid';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Individual preference version entry as fetched from the database.
 */
interface PreferenceVersion<T extends Record<string, any> = Record<string, any>> {
    /**
     * Name of the person who created or updated this version, when known.
     */
    author?: string | null;

    /**
     * Form data associated with this preference version.
     */
    data?: T | null;

    /**
     * The date and time at which this version was recorded.
     */
    version?: Temporal.ZonedDateTime | string | null;
}

/**
 * Props accepted by the <PreferenceHistory> component.
 */
interface PreferenceHistoryProps<T extends Record<string, any> = Record<string, any>> {
    /**
     * Warning message to display when no preferences have been shared yet.
     */
    emptyWarning: string;

    /**
     * The preference versions that should be displayed.
     */
    versions?: PreferenceVersion<T>[];

    /**
     * Children to render within each version's FormGrid.
     */
    children: React.ReactNode;
}

/**
 * Renders the change history of a volunteer's preferences as a list of expandable sections.
 */
export function PreferenceHistory<T extends Record<string, any>>(props: PreferenceHistoryProps<T>) {
    return (
        <>
            <Section noHeader back="Back to preferences" tabs>
                <SectionIntroduction>
                    The Volunteer Managers tracks updates made to these preferences for operational
                    purposes, particularly so that team leads can quickly accommodate last-minute
                    schedule adjustments. Please do not engage in any disputes.
                </SectionIntroduction>
            </Section>
            { !props.versions?.length &&
                <Alert severity="warning" variant="outlined">
                    {props.emptyWarning}
                </Alert> }
            { props.versions?.map(({ author, data, version }, index) => {
                const date = version ? version.toString() : '';
                const title = (
                    <>
                        <LocalDateTime dateTime={date} format="MMMM Do [at] HH:mm" />
                        { !!author && ` (${author})` }
                    </>
                );

                return (
                    <ExpandableSection key={date || index} defaultExpanded={index === 0}
                                       icon={ <TopicOutlinedIcon /> } title={title}>
                        <FormGrid action={undefined!} defaultValues={data}>
                            {props.children}
                        </FormGrid>
                    </ExpandableSection>
                );
            }) }
        </>
    );
}
