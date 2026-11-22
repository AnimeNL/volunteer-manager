// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { DisplayPageClient } from './DisplayPageClient';

/**
 * The <DisplayPage> is the main page of the Display app, which powers the physical devices we will
 * position around the event's location. It's an 1280x800 pixel screen that we should assume can be
 * seen by volunteers and visitors alike. Information will exclusively be sourced from the display
 * context, which is responsible for managing our state.
 */
export default function DisplayPage() {
    return <DisplayPageClient />;
}
