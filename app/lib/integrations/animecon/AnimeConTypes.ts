// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Type definition for the type of activity that can be hosted at an event. Types carry quite a bit
 * of metadata on exactly what the intention of an activity is.
 *
 * @see https://github.com/AnimeNL/rest-api/blob/master/src/Entity/Anplan/ActivityType.php
 */
export const kActivityTypeDefinition = z.object({
    id: z.number(),
    description: z.string(),
    longDescription: z.string(),
    order: z.number(),
    visible: z.boolean(),
    selectable: z.boolean(),
    adultsOnly: z.boolean(),
    competition: z.boolean(),
    cosplay: z.boolean(),
    event: z.boolean(),
    gameRoom: z.boolean(),
    video: z.boolean(),
    cssClass: z.string(),
    cssForegroundColor: z.string().optional().nullable(),
    cssBackgroundColor: z.string().optional().nullable(),
    cssBold: z.boolean(),
    cssIsStrikeThrough: z.boolean(),
});

/**
 * Export of the ActivityType type, derived from the definition.
 */
export type ActivityType = z.infer<typeof kActivityTypeDefinition>;

/**
 * Type definition for a floor that's part of the location at which an event is being hosted. Floors
 * are identified by a unique ID and optionally carry metadata.
 *
 * @see https://github.com/AnimeNL/rest-api/blob/master/src/Entity/Anplan/Floor.php
 */
export const kFloorDefinition = z.object({
    id: z.number(),
    year: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    cssBackgroundColor: z.string().nullable(),
});

/**
 * Export of the Floor type, derived from the definition.
 */
export type Floor = z.infer<typeof kFloorDefinition>;

/**
 * Type definition for a floor as it will be returned by the `floors.json` API. This seems
 * especially useless, but at least this sets our expectations straight.
 *
 * @see https://github.com/AnimeNL/rest-api/blob/master/src/Entity/Anplan/Floor.php (maybe?)
 */
export const kFloorApiDefinition = z.object({
    name: z.string(),
});

/**
 * Export of the FloorApi type, derived from the definition.
 */
export type FloorApi = z.infer<typeof kFloorApiDefinition>;

/**
 * Type definition for a location, which is one of the locations in which activities can be hosted
 * during an event. Locations are identified by a unique ID and happen on a set floor.
 *
 * @see https://github.com/AnimeNL/rest-api/blob/master/src/Entity/Anplan/Location.php
 */
export const kLocationDefinition = z.object({
    id: z.number(),
    year: z.number(),
    name: z.string(),
    useName: z.string().nullable(),
    sponsor: z.string().nullable(),
    area: z.string().nullable(),
    floor: kFloorDefinition.optional(),
    floorId: z.number(),
});

/**
 * Export of the Location type, derived from the definition.
 */
export type Location = z.infer<typeof kLocationDefinition>;

/**
 * Type definition of a timeslot, which describes one of the instances in which an activity is being
 * hosted. Timeslots are identified by a unique ID and happen in a set location.
 *
 * @see https://github.com/AnimeNL/rest-api/blob/master/src/Entity/Anplan/Timeslot.php
 */
export const kTimeslotDefinition = z.object({
    id: z.number(),
    dateStartsAt: z.string(),
    dateEndsAt: z.string(),
    //activity: kActivityDefinition.nullable(),
    location: kLocationDefinition,
});

/**
 * Export of the Timeslot type, derived from the definition.
 */
export type Timeslot = z.infer<typeof kTimeslotDefinition>;

/**
 * Type definition of an Activity. Activities describe events at a particular convention. Each
 * activity is identified by a unique ID, one or more timeslots and a bunch of metadata.
 *
 * @see https://github.com/AnimeNL/rest-api/blob/master/src/Entity/Anplan/Activity.php
 */
export const kActivityDefinition = z.object({
    id: z.number(),
    year: z.string(),  // ...
    festivalId: z.number(),
    title: z.string(),
    sponsor: z.string().nullable(),
    host: z.string().optional().nullable(),
    visible: z.boolean(),
    reasonInvisible: z.string().nullable(),
    spellChecked: z.boolean(),
    maxVisitors: z.number().nullable(),
    price: z.number().nullable(),
    rules: z.string().nullable(),
    description: z.string().nullable(),
    printDescription: z.string().nullable(),
    webDescription: z.string().nullable(),
    socialDescription: z.string().nullable(),
    url: z.string().nullable(),
    prizes: z.string().nullable(),
    techInfo: z.string().optional(/* gated on access */).nullable(),
    logisticsInfo: z.string().optional(/* gated on access */).nullable(),
    financeInfo: z.string().optional(/* gated on access */).nullable(),
    ticketsInfo: z.string().optional(/* gated on access */).nullable(),
    helpNeeded: z.boolean(),
    reportToEmail: z.string().optional(/* gated on access */).nullable(),
    reportToName: z.string().optional(/* gated on access */).nullable(),
    largeImage: z.string().nullable(),
    smallImage: z.string().nullable(),
    activityType: kActivityTypeDefinition.nullable(),
    timeslots: z.array(kTimeslotDefinition),
});

/**
 * Export of the Activity type, derived from the definition.
 */
export type Activity = z.infer<typeof kActivityDefinition>;
