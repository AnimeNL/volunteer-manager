// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { BackButtonGrid } from '@app/admin/components/BackButtonGrid';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { Markdown } from '@components/Markdown';
import { createGenerateMetadataFn } from '../../../../lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tNardoPersonalised, tUsers } from '@lib/database';

/**
 * This page displays an individual piece of personalised advice to the reader, to inspect whether
 * the AI is generating reasonable results based on the given input.
 */
export default async function NardoPersonalisedAdvicePage(
    props: PageProps<'/admin/organisation/nardo/personalised/[id]'>)
{
    const { id } = await props.params;

    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.nardo',
    });

    const dbInstance = db;
    const advice = await dbInstance.selectFrom(tNardoPersonalised)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tNardoPersonalised.nardoPersonalisedUserId))
        .where(tNardoPersonalised.nardoPersonalisedId.equals(parseInt(id, /* radix= */ 10)))
        .select({
            date: dbInstance.dateTimeAsString(tNardoPersonalised.nardoPersonalisedDate),
            user: {
                id: tUsers.userId,
                name: tUsers.name,
            },
            input: tNardoPersonalised.nardoPersonalisedInput,
            output: tNardoPersonalised.nardoPersonalisedOutput,
        })
        .executeSelectNoneOrOne();

    if (!advice)
        notFound();

    return (
        <Grid container spacing={2}>
            <BackButtonGrid href="/admin/organisation/nardo/personalised">
                Back to personalised advice
            </BackButtonGrid>

            <Grid size={{ xs: 12 }} sx={{ mt: -1 }}><Divider /></Grid>
            <Grid size={{ xs: 12 }} sx={{ mt: -2 }}>
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">Volunteer</TableCell>
                            <TableCell>
                                <MuiLink component={Link}
                                         href={`/admin/organisation/accounts/${advice.user.id}`}>
                                    {advice.user.name}
                                </MuiLink>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">Date</TableCell>
                            <TableCell>
                                <LocalDateTime dateTime={advice.date}
                                               format="YYYY-MM-DD HH:mm:ss" />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Grid>

            <Grid size={{ xs: 12 }}>
                <Typography variant="h6" sx={{ mt: -1, mb: 1 }}>
                    Generated advice
                </Typography>
                <Markdown defaultVariant="body2">{advice.output}</Markdown>
            </Grid>

            <Grid size={{ xs: 12 }}><Divider /></Grid>
            <Grid size={{ xs: 12 }}>
                <Typography variant="h6" sx={{ mt: -1, mb: 1 }}>
                    Input prompt
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {advice.input}
                </Typography>
            </Grid>

        </Grid>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Personalised Advice', 'Del a Rie Advies', 'Organisation');
