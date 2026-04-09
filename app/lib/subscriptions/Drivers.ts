// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Driver } from './Driver';

import { ApplicationDriver } from './drivers/ApplicationDriver';
import { HelpDriver } from './drivers/HelpDriver';
import { IncidentDriver } from './drivers/IncidentDriver';
import { RegistrationDriver } from './drivers/RegistrationDriver';
import { type SubscriptionType, kSubscriptionType } from '@lib/database/Types';
import { TestDriver } from './drivers/TestDriver';

/**
 * The drivers that enable fanout of individual publications. Each driver must be an implementation
 * of the `Driver` type, and implement each of the messaging channels independently.
 */
export const kSubscriptionFactories = {
    [kSubscriptionType.Application]: () => new ApplicationDriver,
    [kSubscriptionType.Help]: () => new HelpDriver,
    [kSubscriptionType.Incident]: () => new IncidentDriver,
    [kSubscriptionType.Registration]: () => new RegistrationDriver,
    [kSubscriptionType.Test]: () => new TestDriver,
} as const satisfies { [k in SubscriptionType]: () => Driver<any> };
