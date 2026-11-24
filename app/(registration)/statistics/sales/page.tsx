// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

/**
 * Index of the /statistics/sales page. We don't (yet) support global sales statistics, so an HTTP
 * 404 Not Found error will be shown instead.
 */
export default async function SalesStatisticsPage() {
    notFound();
}
