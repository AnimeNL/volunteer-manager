// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

// By default, no history card is shown. Each of the possible routes in this interface do override
// the default, so in practice this should never be hit, as it leads to weird caching issues in
// Next.js where parallel routes don't update on URL change. (Oddly marked as intended behaviour.)
export default () => null;
