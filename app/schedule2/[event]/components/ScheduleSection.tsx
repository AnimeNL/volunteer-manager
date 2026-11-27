// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Stack from '@mui/material/Stack';

import { ScheduleList } from './ScheduleList';
import { SectionHeader } from './SectionHeader';

/**
 * Props accepted by the `<ScheduleSection>` component.
 */
interface ScheduleSectionProps {
    actionLabel?: string;
    href?: string;
    muted?: boolean;
    title: React.ReactNode;
}

/**
 * Groups a `<SectionHeader>` and its conjoined `<ScheduleList>` with consistent vertical spacing.
 */
export function ScheduleSection(props: React.PropsWithChildren<ScheduleSectionProps>) {
    const { actionLabel, children, href, muted, title } = props;

    return (
        <Stack spacing={0.75} useFlexGap>
            <SectionHeader actionLabel={actionLabel} href={href} muted={muted} title={title} />
            <ScheduleList muted={muted}>
                {children}
            </ScheduleList>
        </Stack>
    );
}
