// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { ScheduleList, ScheduleListRow } from './ScheduleList';
import { ScheduleSection } from './ScheduleSection';

/**
 * Leading placeholder adornment supported by schedule list skeletons.
 */
type SkeletonLeadingVariant = 'avatar' | 'dot';

/**
 * Renders the optional leading circular placeholder for a skeleton row.
 */
function renderSkeletonLeading(leading?: SkeletonLeadingVariant): React.ReactNode {
    if (leading === 'avatar')
        return <Skeleton variant="circular" width={36} height={36} />;
    if (leading === 'dot')
        return <Skeleton variant="circular" width={10} height={10} />;

    return undefined;
}

/**
 * Configuration for a single section group rendered by `<ScheduleListSkeleton>`.
 */
interface ScheduleListSkeletonGroup {
    leading?: SkeletonLeadingVariant;
    rows: number[];
    subtitleWidths?: number[];
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
            { group.rows.map((rowWidth, rowIndex) => {
                const subtitleWidth = group.subtitleWidths?.[rowIndex];
                return (
                    <ScheduleListRow
                        key={rowIndex}
                        leading={renderSkeletonLeading(group.leading)}
                        subtitle={subtitleWidth !== undefined
                            ? <Skeleton variant="text" width={subtitleWidth} />
                            : undefined}
                        title={ <Skeleton variant="text" width={rowWidth} /> }
                        trailing={group.trailingWidth !== undefined
                            ? <Skeleton variant="text" width={group.trailingWidth} />
                            : undefined} />
                );
            }) }
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
    leading?: SkeletonLeadingVariant;
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
                    leading={renderSkeletonLeading(props.leading)}
                    subtitle={subtitleWidth !== undefined
                        ? <Skeleton variant="text" width={subtitleWidth} />
                        : undefined}
                    title={ <Skeleton variant="text" width={titleWidth} /> } /> ) }
        </ScheduleList>
    );
}
