// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Whether authentication cookies should carry the `Secure` attribute. Enabled in production where
 * traffic is served over HTTPS, while still allowing local HTTP development.
 */
export const kSecureCookie = process.env.NODE_ENV === 'production';
