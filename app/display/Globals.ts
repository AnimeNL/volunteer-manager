// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Temporal } from '@lib/Temporal';
import device from './lib/Device';

declare namespace globalThis {
    let animeConBrightnessValue: number;
    let animeConColorValue: string | undefined;
    let animeConInitialised: boolean;
    let animeConLockedValue: boolean;
    let animeConTimeOffsetSeconds: number | undefined;
    let animeConUpdatedInstant: Temporal.Instant;
    let animeConVolumeValue: number;
}

/**
 * Initialises the global values. This function guarantees to only execute once.
 */
export function onceInitialiseGlobals() {
    if (!!globalThis.animeConInitialised)
        return;

    globalThis.animeConInitialised = true;
    globalThis.animeConLockedValue = false;
    globalThis.animeConTimeOffsetSeconds = undefined;

    globalThis.animeConColorValue = undefined;

    device.setLightColour(0, 0, 0);  // turn the lights off

    device.getBrightness().then(brightness => {
        globalThis.animeConBrightnessValue = brightness ?? /* default= */ 50;
    });

    device.getVolume().then(volume => {
        globalThis.animeConVolumeValue = volume ?? /* default= */ 0;
    });

    device.disableKiosk();
}

/**
 * Returns the global brightness value.
 */
export function getBrightnessValue(): number {
    return globalThis.animeConBrightnessValue ?? /* default= */ 50;
}

/**
 * Sets the global brightness value to the given `value`.
 */
export function setBrightnessValue(value: number): void {
    globalThis.animeConBrightnessValue = value;
}

/**
 * Returns the global color value.
 */
export function getColorValue(): string | undefined {
    return globalThis.animeConColorValue;
}

/**
 * Sets the global color value to the given `value`.
 */
export function setColorValue(value: string | undefined): void {
    globalThis.animeConColorValue = value;
}

/**
 * Returns the Temporal `ZonedDateTime` that represents the current moment in time, either in the
 * given `timezone` when set, or otherwise in UTC.
 */
export function getCurrentZonedDateTime(timezone?: string): Temporal.ZonedDateTime {
    const currentZonedDateTime = Temporal.Now.zonedDateTimeISO(timezone ?? 'UTC');
    if (!!globalThis.animeConTimeOffsetSeconds)
        return currentZonedDateTime.add({ seconds: globalThis.animeConTimeOffsetSeconds });

    return currentZonedDateTime;
}

/**
 * Returns whether the device is currently locked.
 */
export function isLockedValue(): boolean {
    return globalThis.animeConLockedValue;
}

/**
 * Sets the global locked value to the given `value`.
 */
export function setLockedValue(value: boolean): void {
    globalThis.animeConLockedValue = value;
}

/**
 * Marks the display as having updated at this moment.
 */
export function markUpdateCompleted(): void {
    globalThis.animeConUpdatedInstant = Temporal.Now.instant();
}

/**
 * Returns whether the display has recently updated. An update will be considered updated if the
 * most recent update was five minutes ago or less.
 */
export function hasRecentlyUpdated(): boolean {
    if (!globalThis.animeConUpdatedInstant)
        return false;

    const difference = globalThis.animeConUpdatedInstant.until(Temporal.Now.instant(), {
        largestUnit: 'second',
    });

    return difference.seconds <= 5 * 60;
}

/**
 * Updates the time offset under which the display operates to the given `seconds`.
 */
export function setTimeOffset(seconds?: number): void {
    globalThis.animeConTimeOffsetSeconds = seconds;
}

/**
 * Returns the global volume value.
 */
export function getVolumeValue(): number {
    return globalThis.animeConVolumeValue ?? /* default= */ 0;
}

/**
 * Sets the global volume value to the given `value`.
 */
export function setVolumeValue(value: number): void {
    globalThis.animeConVolumeValue = value;
}
