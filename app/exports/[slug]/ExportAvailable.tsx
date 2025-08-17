// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import LaunchIcon from '@mui/icons-material/Launch';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

import type { BuildUpTearDownDataExport, CreditsDataExport, DiscordDataExport, RefundsDataExport,
    TrainingsDataExport, VolunteersDataExport, WhatsAppDataExport } from '@app/api/exports/route';

import type { ExportMetadata } from './ExportMetadata';
import { ExportCredits } from './ExportCredits';
import { ExportDiscord } from './ExportDiscord';
import { ExportRefunds } from './ExportRefunds';
import { ExportTrainings } from './ExportTrainings';
import { ExportVolunteers } from './ExportVolunteers';
import { ExportWhatsapp } from './ExportWhatsapp';
import { callApi } from '@lib/callApi';

import { kExportType } from '@lib/database/Types';
import { ExportBuildUpTearDown } from './ExportBuildUpTearDown';

/**
 * Props accepted by the <ExportAvailable> component.
 */
interface ExportAvailableProps {
    /**
     * Metadata about the export that's being presented on this page.
     */
    metadata: ExportMetadata;
}

/**
 * The <ExportAvailable> component handles the case where the export data is available. The visitor
 * has to acknowledge that they want to access the data after which they can make an API call to
 * retrieve it. It will then be rendered client-side in their browser for consumption.
 */
export function ExportAvailable(props: ExportAvailableProps) {
    const { metadata } = props;

    let description: string;
    switch (metadata.type) {
        case kExportType.BuildUp:
            description = 'build-up volunteers';
            break;
        case kExportType.Credits:
            description = 'credit real consent';
            break;
        case kExportType.Discord:
            description = 'Discord handles';
            break;
        case kExportType.Refunds:
            description = 'ticket refund requests';
            break;
        case kExportType.TearDown:
            description = 'tear-down volunteers';
            break;
        case kExportType.Trainings:
            description = 'training participation';
            break;
        case kExportType.Volunteers:
            description = 'volunteer participation';
            break;
        case kExportType.WhatsApp:
            description = 'WhatsApp contact details';
            break;
        default:
            throw new Error(`Unrecognised export type: ${metadata.type}`);
    }

    const [ buildUp, setBuildUp ] = useState<BuildUpTearDownDataExport | undefined>();
    const [ credits, setCredits ] = useState<CreditsDataExport | undefined>();
    const [ discord, setDiscord ] = useState<DiscordDataExport | undefined>();
    const [ refunds, setRefunds ] = useState<RefundsDataExport | undefined>();
    const [ tearDown, setTearDown ] = useState<BuildUpTearDownDataExport | undefined>();
    const [ trainings, setTrainings ] = useState<TrainingsDataExport | undefined>();
    const [ volunteers, setVolunteers ] = useState<VolunteersDataExport | undefined>();
    const [ whatsapp, setWhatsapp ] = useState<WhatsAppDataExport | undefined>();

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    const handleAccessData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await callApi('post', '/api/exports', {
                slug: metadata.slug,
            });

            if (response.success) {
                setBuildUp(response.buildUp);
                setCredits(response.credits);
                setDiscord(response.discord);
                setRefunds(response.refunds);
                setTearDown(response.tearDown);
                setTrainings(response.trainings);
                setVolunteers(response.volunteers);
                setWhatsapp(response.whatsapp);
            } else {
                setError(response.error ?? 'Unable to retrieve the data from our server');
            }
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false)
        }
    }, [ metadata.slug ]);

    return (
        <>
            <Paper sx={{ p: 2, textAlign: 'center', textWrap: 'balance' }}>
                {metadata.userName} shared information about {metadata.eventName} {description}{' '}
                with you. Please treat this information carefully and let us know immediately if you
                received this in error.
            </Paper>
            <Collapse in={!!error} unmountOnExit>
                <Alert elevation={1} severity="error" sx={{ px: 2, py: 1 }}>
                    {error}
                </Alert>
            </Collapse>
            <Collapse in={!buildUp && !credits && !discord && !tearDown && !trainings &&
                          !volunteers && !whatsapp}
                      unmountOnExit>
                <Paper component={Stack} alignItems="center" sx={{ p: 2 }}>
                    <Button loading={loading} variant="contained" onClick={handleAccessData}
                            startIcon={ <LaunchIcon /> }>
                        Access data
                    </Button>
                </Paper>
            </Collapse>
            <Collapse in={!!buildUp} unmountOnExit>
                <ExportBuildUpTearDown buildUpTearDown={buildUp!} />
            </Collapse>
            <Collapse in={!!credits} unmountOnExit>
                <ExportCredits credits={credits!} />
            </Collapse>
            <Collapse in={!!discord} unmountOnExit>
                <ExportDiscord discord={discord!} />
            </Collapse>
            <Collapse in={!!refunds} unmountOnExit>
                <ExportRefunds refunds={refunds!} />
            </Collapse>
            <Collapse in={!!tearDown} unmountOnExit>
                <ExportBuildUpTearDown buildUpTearDown={tearDown!} />
            </Collapse>
            <Collapse in={!!trainings} unmountOnExit>
                <ExportTrainings trainings={trainings!} />
            </Collapse>
            <Collapse in={!!volunteers} unmountOnExit>
                <ExportVolunteers volunteers={volunteers!} />
            </Collapse>
            <Collapse in={!!whatsapp} unmountOnExit>
                <ExportWhatsapp whatsapp={whatsapp!} />
            </Collapse>
        </>
    );
}
