// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import GoogleIcon from '@mui/icons-material/Google';
import HeatPumpIcon from '@mui/icons-material/HeatPump';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { ServiceHealthDefinition } from '@app/api/admin/serviceHealth';
import { ContrastBox } from '../components/ContrastBox';
import { issueServerAction } from '@lib/issueServerAction';

type ServiceHealthRequest = ServiceHealthDefinition['request'];
type ServiceHealthResponse = ServiceHealthDefinition['response'];

/**
 * Runs a service health check for the given `service`. This will call an endpoint on the server as
 * the health checks cannot be carried out client-side. Calls will be made in parallel.
 */
async function determineServiceStatus(service: ServiceHealthRequest['service'])
    : Promise<ServiceHealthResponse>
{
    try {
        return issueServerAction<ServiceHealthDefinition>('/api/admin/service-health', {
            service,
        });
    } catch (error: any) {
        return {
            service,
            status: 'error',
            message: error.message,
        };
    }
}

/**
 * Props accepted by the <ServiceStatus> component.
 */
interface ServiceStatusProps {
    /**
     * Icon as the service should be represented.
     */
    icon: React.ReactNode;

    /**
     * The label of the service to display.
     */
    label: string;

    /**
     * Status of the service, as confirmed by the lifetime check. Status messages may not be set
     * when no health check has been initiated yet.
     */
    status?: ServiceHealthDefinition['response']['status'];
}

/**
 * The <ServiceStatus> component represents the status of an individual service whose state should
 * be displayed on this page. The `props` indicate the state of the service.
 */
function ServiceStatus(props: ServiceStatusProps) {
    let color = 'text.disabled';
    switch (props.status) {
        case 'error':
        case 'success':
        case 'warning':
            color = `${props.status}.main`;
            break;
    }

    return (
        <Stack direction="column" spacing={1} sx={{ width: '100px', color }}
               justifyContent="center" alignItems="center">
            {props.icon}
            <Typography>
                {props.label}
            </Typography>
        </Stack>
    );
}

/**
 * The <StatusHeader> component displays the header of the Integrations page, and also includes the
 * ability to do a "ping" check to each of the external integrations to test if they're functional.
 */
export function StatusHeader() {
    const [ loading, setLoading ] = useState<boolean>(false);

    const [ googleStatus, setGoogleStatus ] = useState<ServiceHealthResponse>();
    const [ vertexAiStatus, setVertexAiStatus ] = useState<ServiceHealthResponse>();

    const handleHealthCheck = useCallback(async () => {
        setLoading(true);
        await Promise.all([
            determineServiceStatus('Google').then(result => setGoogleStatus(result)),
            determineServiceStatus('VertexAI').then(result => setVertexAiStatus(result)),
        ]);
        setLoading(false);
    }, [ /* no deps */ ]);

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
                Integrations
            </Typography>
            <Stack direction="row" spacing={2}>
                <ContrastBox sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
                    { loading && <CircularProgress size="40px" /> }
                    { !loading &&
                        <Tooltip title="Verify integrations">
                            <IconButton onClick={handleHealthCheck}>
                                <PublishedWithChangesIcon />
                            </IconButton>
                        </Tooltip> }
                </ContrastBox>
                <ContrastBox sx={{ p: 2, flexGrow: 1 }}>
                    <Stack direction="row" spacing={2}
                           divider={ <Divider orientation="vertical" flexItem /> }>

                        <ServiceStatus icon={ <GoogleIcon /> }
                                       label="Google" status={googleStatus?.status} />

                        <ServiceStatus icon={ <HeatPumpIcon /> }
                                       label="Vertex AI" status={vertexAiStatus?.status} />

                    </Stack>
                </ContrastBox>
            </Stack>
            { [ googleStatus, vertexAiStatus ].map((status, index) =>
                <Collapse in={ [ 'error', 'warning' ].includes(status?.status!) } key={index}>
                    <Alert sx={{ mt: 2 }} severity={ (status?.status ?? 'info') as any }>
                        <strong>{status?.service}</strong>: {status?.message}
                    </Alert>
                </Collapse> )}
        </Paper>
    );
}
