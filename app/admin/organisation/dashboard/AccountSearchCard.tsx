// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';
import SearchIcon from '@mui/icons-material/Search';
import Stack from '@mui/material/Stack';

import { AccountSearchInput } from './AccountSearchInput';
import db, { tUsers } from '@lib/database';

/**
 * The <AccountSearchCard> component is a full-width card through the signed in volunteer is able
 * to easily find an account. The search function works across properties, i.e. names, e-mail
 * addresses, phone numbers, and so on.
 */
export async function AccountSearchCard() {
    const accounts = await db.selectFrom(tUsers)
        .where(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            keywords: {
                username: tUsers.username,
                phoneNumber: tUsers.phoneNumber,
                discordHandle: tUsers.discordHandle,
            },
        })
        .orderBy(tUsers.name, 'asc')
        .executeSelectMany();

    const normalisedAccounts = accounts.map(entry => {
        const { keywords, ...rest } = entry;
        return {
            ...rest,
            keywords: Object.values(keywords || {}).filter(Boolean).join(' '),
        };
    });

    return (
        <Stack component={Card} direction="row" spacing={2} sx={{ p: 2 }} alignItems="center">
            <SearchIcon />
            <AccountSearchInput accounts={normalisedAccounts} />
        </Stack>
    );
}
