// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { ScheduleList, ScheduleListRow } from './ScheduleList';
import { ScheduleSection } from './ScheduleSection';

/**
 * Configuration for a single section group rendered by `<ScheduleListSkeleton>`.
 */
interface ScheduleListSkeletonGroup {
    rows: number[];
    titleWidth: number;
    trailingWidth?: number;
}

/**
 * Props accepted by the `<ScheduleListSkeleton>` component.
 */
interface ScheduleListSkeletonProps {
    groups: ScheduleListSkeletonGroup[];
}

/**
 * Renders a single `<SectionHeader>` and conjoined `<ScheduleList>` skeleton group.
 */
function renderSkeletonGroup(group: ScheduleListSkeletonGroup, key?: number) {
    return (
        <ScheduleSection key={key} title={ <Skeleton variant="text" width={group.titleWidth} /> }>
            { group.rows.map((rowWidth, rowIndex) =>
                <ScheduleListRow
                    key={rowIndex}
                    title={ <Skeleton variant="text" width={rowWidth} /> }
                    trailing={group.trailingWidth !== undefined
                        ? <Skeleton variant="text" width={group.trailingWidth} />
                        : undefined} /> ) }
        </ScheduleSection>
    );
}

/**
 * Skeleton placeholder mirroring one or more conjoined `<ScheduleList>` sections while streaming.
 */
export function ScheduleListSkeleton(props: ScheduleListSkeletonProps) {
    if (props.groups.length === 1)
        return renderSkeletonGroup(props.groups[0]);

    return (
        <Stack spacing={2} useFlexGap>
            { props.groups.map((group, groupIndex) => renderSkeletonGroup(group, groupIndex)) }
        </Stack>
    );
}

/**
 * Props accepted by the `<SegmentedListSkeleton>` component.
 */
interface SegmentedListSkeletonProps {
    chevron?: boolean;
    rows: { subtitleWidth?: number; titleWidth: number }[];
}

/**
 * Skeleton placeholder mirroring a segmented `<ScheduleList>` while items are streaming.
 */
export function SegmentedListSkeleton(props: SegmentedListSkeletonProps) {
    return (
        <ScheduleList variant="segmented">
            { props.rows.map(({ subtitleWidth, titleWidth }, index) =>
                <ScheduleListRow
                    key={index}
                    chevron={props.chevron}
                    subtitle={subtitleWidth !== undefined
                        ? <Skeleton variant="text" width={subtitleWidth} />
                        : undefined}
                    title={ <Skeleton variant="text" width={titleWidth} /> } /> ) }
        </ScheduleList>
    );
}
