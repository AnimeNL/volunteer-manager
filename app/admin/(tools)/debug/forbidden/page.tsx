// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';

/**
 * Debugging page that triggers the HTTP 403 Forbidden page. 
 */
export default function DebugForbiddenPage() {
    forbidden();
}
