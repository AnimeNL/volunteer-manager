// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

/**
 * The <EventWebsiteVoidContentPage> page represents an ID-less content request, which is invalid
 * and will thus throw an HTTP 404 Error.
 */
export default async function EventWebsiteVoidContentPage(
    props: PageProps<'/admin/events/[event]/[team]/website/content'>)
{
    notFound();
}
