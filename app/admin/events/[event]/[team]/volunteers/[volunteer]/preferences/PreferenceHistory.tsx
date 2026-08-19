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
 * Describes a single version entry in preference history.
 */
interface PreferenceVersion<T extends Record<string, any> = Record<string, any>> {
    /**
     * Name of the user who recorded this preference version.
     */
    author?: string | null;

    /**
     * Form values recorded for this version.
     */
    data?: T | null;

    /**
     * Date and time when this version was created.
     */
    version?: Temporal.ZonedDateTime | string | null;
}

/**
 * Props accepted by the <PreferenceHistory> component.
 */
interface PreferenceHistoryProps<T extends Record<string, any> = Record<string, any>> {
    /**
     * Warning message to show when no preference history exists.
     */
    emptyWarning: string;

    /**
     * List of preference version entries to display.
     */
    versions?: PreferenceVersion<T>[];

    /**
     * Form fields to render within each version entry.
     */
    children: React.ReactNode;
}

/**
 * Displays the version history of volunteer preferences as expandable sections.
 */
export function PreferenceHistory<T extends Record<string, any>>(props: PreferenceHistoryProps<T>) {
    return (
        <>
            <Section noHeader back="Back to preferences" tabs>
                <SectionIntroduction>
                    The Volunteer Manager tracks updates made to these preferences for operational
                    purposes, particularly so that team leads can accommodate last-minute
                    schedule adjustments.
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
