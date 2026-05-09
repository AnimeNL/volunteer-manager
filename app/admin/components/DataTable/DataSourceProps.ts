// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AccessControl } from "@lib/auth/AccessControl";
import type { AuthenticationContext } from "@lib/auth/AuthenticationContext";

/**
 * Props made available to methods on the data source.
 */
export interface DataSourceProps {
    /**
     * Access control management for the visitor, which may be used for permission checks.
     */
    access: AccessControl;

    /**
     * Authentication context resulting from authenticating the visitor.
     */
    authenticationContext: AuthenticationContext;
}
