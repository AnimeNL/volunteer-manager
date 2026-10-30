// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ThinkingLevel } from '@google/genai';
import { vi } from 'vitest';

import { Client, type ClientSettings } from './Client';
import { Instrumentation } from '../Instrumentation';

const mockGenerateContentStream = vi.fn();
const mockListModels = vi.fn();
let capturedOptions: any;

vi.mock('@google/genai', async importOriginal => {
    const actual = await importOriginal<typeof import('@google/genai')>();
    return {
        ...actual,
        GoogleGenAI: class {
            models = {
                generateContentStream: mockGenerateContentStream,
                list: mockListModels,
            };
            constructor(options: any) {
                capturedOptions = options;
            }
        },
    };
});

describe('GenAI Client', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    let withContextSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        capturedOptions = undefined;
        mockGenerateContentStream.mockReset();
        mockListModels.mockReset();

        fetchSpy = vi.spyOn(globalThis, 'fetch');
        withContextSpy = vi.spyOn(Instrumentation, 'withContext');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const kDefaultSettings: ClientSettings = {
        api: 'Gemini',
        apiKey: 'my-gemini-api-key',
        googleCloud: {
            credentials: JSON.stringify({ client_email: 'service@animecon.nl' }),
            location: 'europe-west4',
            project: 'animecon-genai',
        },
        models: {
            image: 'gemini-3.1-flash-image',
            text: {
                low: 'gemini-3.1-flash-lite',
                medium: 'gemini-3.8-flash',
                high: 'gemini-3.1-pro-preview',
            },
        },
        quality: {
            temperature: 0.7,
            topP: 0.9,
            thinkingLevel: 'medium',
        },
    };

    it('configures GoogleGenAI for both Gemini and GeminiEnterprise backends', () => {
        new Client(kDefaultSettings);
        expect(capturedOptions).toEqual({
            apiKey: 'my-gemini-api-key',
            httpOptions: {
                fetch: expect.any(Function),
            },
        });

        new Client({
            ...kDefaultSettings,
            api: 'GeminiEnterprise',
        });
        expect(capturedOptions).toEqual({
            enterprise: true,
            googleAuthOptions: {
                credentials: { client_email: 'service@animecon.nl' },
            },
            location: 'europe-west4',
            project: 'animecon-genai',
            httpOptions: {
                fetch: expect.any(Function),
            },
        });
    });

    it('streams and concatenates text responses with attachments and thinking configuration', async () => {
        mockGenerateContentStream.mockImplementationOnce(async () => (async function* () {
            yield { responseId: 'resp-1', text: 'Hello, ' };
            yield { responseId: 'resp-1', text: 'AnimeCon!' };
        })());

        const client = new Client(kDefaultSettings);
        const result = await client.safeGenerateText({
            complexity: 'high',
            thinkingLevel: 'low',
            prompt: 'Greet the volunteers',
            systemPrompt: 'You are a helpful festival assistant.',
            attachments: [
                {
                    bytes: new Uint8Array([ 1, 2, 3 ]),
                    mimeType: 'application/octet-stream',
                },
            ],
        });

        expect(result).toEqual({
            success: true,
            responseId: 'resp-1',
            text: 'Hello, AnimeCon!',
        });

        expect(mockGenerateContentStream).toHaveBeenCalledWith({
            model: 'gemini-3.1-pro-preview',
            contents: [
                { text: 'Greet the volunteers' },
                {
                    inlineData: {
                        data: Buffer.from([ 1, 2, 3 ]).toString('base64'),
                        mimeType: 'application/octet-stream',
                    },
                },
            ],
            config: {
                candidateCount: 1,
                temperature: 0.7,
                topP: 0.9,
                systemInstruction: 'You are a helpful festival assistant.',
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                },
            },
        });
    });

    it('returns { success: false, error } when safeGenerateText or safeGenerateImage fails', async () => {
        mockGenerateContentStream.mockRejectedValueOnce(new Error('Quota exceeded'));

        const client = new Client(kDefaultSettings);
        const textResult = await client.safeGenerateText({
            prompt: 'Hello',
        });

        expect(textResult).toEqual({
            success: false,
            error: 'Quota exceeded',
        });

        mockGenerateContentStream.mockRejectedValueOnce(new Error('Image generation failed'));
        const imageResult = await client.safeGenerateImage({
            prompt: 'Draw a mascot',
            aspectRatio: '1:1',
        });

        expect(imageResult).toEqual({
            success: false,
            error: 'Image generation failed',
        });
    });

    it('instruments fetch calls, strips query strings, and omits response bodies for images', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        fetchSpy.mockResolvedValueOnce(new Response('binary-image-data', { status: 200 }));

        mockGenerateContentStream.mockImplementationOnce(async params => {
            await params.config.httpOptions.fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/image:generate?key=secret',
                { method: 'POST' });

            return (async function* () {
                yield { responseId: 'img-1', data: 'base64-chunk-1' };
                yield { responseId: 'img-1', data: '-chunk-2', text: 'Mascot' };
            })();
        });

        const client = new Client(kDefaultSettings);

        // (1) Standard SDK fetch hook (text / models):
        await capturedOptions.httpOptions.fetch(
            'https://generativelanguage.googleapis.com/v1beta/models?key=secret',
            { method: 'GET' });

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'GenAI',
            operation: 'https://generativelanguage.googleapis.com/v1beta/models',
        });

        // (2) Image generation fetch hook (sets omitResponseBody: true):
        const imageSpy = vi.spyOn(Instrumentation.prototype, 'instrumentedFetch');
        const imageResult = await client.safeGenerateImage({
            prompt: 'Draw a mascot',
            aspectRatio: '16:9',
        });

        expect(imageResult).toEqual({
            success: true,
            responseId: 'img-1',
            data: 'base64-chunk-1-chunk-2',
            text: 'Mascot',
        });

        expect(withContextSpy).toHaveBeenLastCalledWith({
            integration: 'GenAI',
            operation: 'https://generativelanguage.googleapis.com/v1beta/models/image:generate',
        });
        expect(imageSpy).toHaveBeenCalledWith(
            'https://generativelanguage.googleapis.com/v1beta/models/image:generate?key=secret',
            { method: 'POST' },
            { omitResponseBody: true });
    });

    it('lists available models advertised by the endpoint', async () => {
        mockListModels.mockResolvedValueOnce((async function* () {
            yield { name: 'models/gemini-3.8-flash', version: '001' };
            yield {};
        })());

        const client = new Client(kDefaultSettings);
        const models = await client.listModels();

        expect(models).toEqual([
            { name: 'models/gemini-3.8-flash', version: '001' },
            { name: 'Undefined', version: 'default' },
        ]);
    });
});
