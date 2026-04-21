// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import device from './lib/Device';

export function ClientTest() {

    const [ messages, setMessages ] = useState<string[]>([]);

    async function executeBooleanCommand(label: string, fn: () => Promise<boolean>) {
        setMessages(messages => [ `Executing command: ${label}`, ...messages ]);
        const result = await fn();
        setMessages(messages => [ `Result: ${!!result ? 'true' : 'false' }`, ...messages ]);
    }

    async function executeIpCommand() {
        setMessages(messages => [ 'Executing command: ip', ...messages ]);
        const result = await device.getIpAddresses();
        setMessages(messages => [ `Result: ${result?.join(', ')}`, ...messages ]);
    }

    function setBrightness(value: number) {
        executeBooleanCommand('brightness', () => device.setBrightness(value));
    }

    async function getBrightness() {
        setMessages(messages => [ 'Executing command: brightness:get', ...messages ]);
        const result = await device.getBrightness();
        setMessages(messages => [ `Result: ${result ?? 'undefined'}`, ...messages ]);
    }

    function setKiosk(enabled: boolean) {
        if (enabled)
            executeBooleanCommand('kiosk (enable)', () => device.enableKiosk());
        else
            executeBooleanCommand('kiosk (disable)', () => device.disableKiosk());
    }

    async function setLight(r: number, g: number, b: number) {
        executeBooleanCommand('light', () => device.setLightColour(r, g, b));
    }

    function reconnectLight() {
        executeBooleanCommand('light (reconnect)', () => device.reconnectLightSerialPort());
    }

    function setVolume(value: number) {
        executeBooleanCommand('volume', () => device.setVolume(value));
    }

    async function getVolume() {
        setMessages(messages => [ 'Executing command: volume:get', ...messages ]);
        const result = await device.getVolume();
        setMessages(messages => [ `Result: ${result ?? 'undefined'}`, ...messages ]);
    }

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5">
                Display test component
            </Typography>
            <Stack direction="column" spacing={2} sx={{ my: 2 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                        Brightness
                    </Typography>
                    <Button variant="outlined" onClick={ () => getBrightness() }>(get)</Button>
                    <Button variant="outlined" onClick={ () => setBrightness(50) }>50</Button>
                    <Button variant="outlined" onClick={ () => setBrightness(150) }>150</Button>
                    <Button variant="outlined" onClick={ () => setBrightness(255) }>255</Button>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                        Kiosk
                    </Typography>
                    <Button variant="outlined" onClick={ () => setKiosk(true) }>Enable</Button>
                    <Button variant="outlined" onClick={ () => setKiosk(false) }>Disable</Button>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                        Light
                    </Typography>
                    <Button variant="outlined" onClick={ () => setLight(255, 0, 0) }>Red</Button>
                    <Button variant="outlined" onClick={ () => setLight(0, 255, 0) }>Green</Button>
                    <Button variant="outlined" onClick={ () => setLight(0, 0, 255) }>Blue</Button>
                    <Button variant="outlined" onClick={ () => setLight(255, 95, 0) }>
                        Orange
                    </Button>
                    <Button variant="outlined" onClick={ () => setLight(255, 255, 0) }>
                        Yellow
                    </Button>
                    <Button variant="outlined" onClick={ () => setLight(255, 255, 255) }>
                        White
                    </Button>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                        Light²
                    </Typography>
                    <Button variant="outlined" onClick={ () => reconnectLight() }>Reconnect</Button>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                        Volume
                    </Typography>
                    <Button variant="outlined" onClick={ () => getVolume() }>(get)</Button>
                    <Button variant="outlined" onClick={ () => setVolume(50) }>50</Button>
                    <Button variant="outlined" onClick={ () => setVolume(150) }>150</Button>
                    <Button variant="outlined" onClick={ () => setVolume(255) }>255</Button>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                        Misc
                    </Typography>
                    <Button variant="outlined" onClick={ () => executeIpCommand() }>IP</Button>
                </Stack>
            </Stack>
            <Box>
                <ul>
                    { messages.map((message, index) =>
                        <li key={index}>{message}</li> )}
                </ul>
            </Box>
        </Paper>
    );
}
