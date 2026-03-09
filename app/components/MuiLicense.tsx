// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { LicenseInfo, muiXTelemetrySettings } from '@mui/x-license';

/**
 * Opt out of telemetry. It's only enabled by default during development builds and optimised out
 * for production builds.
 */
muiXTelemetrySettings.disableTelemetry();

/**
 * Install the MUI License key. The key itself is specified as an environment variable. When no key
 * is passed, a watermark will be shown instead when MUI X Pro features are being used.
 */
LicenseInfo.setLicenseKey(process.env.NEXT_PUBLIC_MUI_LICENSE_KEY!);

/**
 * The <MuiLicense> element does nothing, but has a side effect of initialising the `LicenseInfo`
 * object on the global scope. This element is only necessary in scopes where MUI X Pro features are
 * being utilised. It's acceptable for the license key to become public.
 */
export function MuiLicense() {
    return null;
}
