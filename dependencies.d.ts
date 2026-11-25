// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

declare module '@AnimeNL/volunteer-manager-timeline' {
    export type CalendarEvent = any;
    export type CalendarProps = any;
    export type ChangeEventContext = any;
    export type ScheduleEvent = any;
    export type ScheduleEventMutation = any;
    export type ScheduleMarker = any;
    export type ScheduleProps = any;
    export type ScheduleResource = any;
    export type TimelineEvent = any;
    export type TimelineEventMutation = any;
    export type TimelineProps = any;

    export const Calendar: any;
    export const Schedule: any;
    export const Timeline: any;
}

declare module 'set.prototype.symmetricdifference' {
    export default function<T>(set: Set<T>, otherSet: Set<T>): Set<T>;
}
