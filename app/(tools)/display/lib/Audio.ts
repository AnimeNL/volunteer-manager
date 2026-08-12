// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

/**
 * Mock the global `Audio` type if it's not available, as the server-side Next.js compile complains.
 */
if (typeof globalThis.Audio === 'undefined')
    globalThis.Audio = class { play() { /* void */ } } as any;

/**
 * Types of audio that can be played by the display.
 */
type AudioTypes = 'ping';

/**
 * The `DisplayAudio` class encapsulates the ability to play audio.
 */
class DisplayAudio {
    #instances: { [k in AudioTypes]: HTMLAudioElement };

    constructor() {
        this.#instances = {
            ping: new Audio('/audio/ping.mp3'),
        };
    }

    /**
     * Plays a sound of the given `type`.
     */
    play(type: AudioTypes): void {
        this.#instances[type].currentTime = 0;
        this.#instances[type].play();
    }
}

/**
 * Create a global instance that can be used by any component in the Display sub-app.
 */
const kAudioInstance = new DisplayAudio;

/**
 * Export the global instance as the default export from this file.
 */
export default kAudioInstance;
