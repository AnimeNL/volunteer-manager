// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ThinkingLevel } from '@google/genai';
import { expectTypeOf, vi } from 'vitest';

import { type ClientSettings, Client } from './Client';
import { Instrumentation } from '../Instrumentation';

const mockCreateDecision = vi.fn();
const mockGenerateContentStream = vi.fn();
const mockListModels = vi.fn();
let capturedOptions: any;

vi.mock('@google/genai', async importOriginal => {
    const actual = await importOriginal<typeof import('@google/genai')>();
    return {
        ...actual,
        GoogleGenAI: class {
            decisions = {
                create: mockCreateDecision,
            };
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
        mockCreateDecision.mockReset();
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
            apiVersion: 'v1beta',
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

    it('evaluates noul, choice, and score decisions with narrowed tuple types', async () => {
        mockCreateDecision.mockResolvedValueOnce({
            answers: {
                '0': { type: 'noul', noul: 0.03, confidence: 0.97 },
                '1': {
                    type: 'choice',
                    choice: 'dark',
                    probabilities: { blue: 0.07, dark: 0.81, sparkling: 0.12 },
                    confidence: 0.71,
                },
                '2': {
                    type: 'score',
                    score: 1.12,
                    probabilities: { '0': 0.47, '1': 0.01, '2': 0.52 },
                    legend: {
                        '0': 'It is an animal',
                        '1': 'It glows in the dark',
                        '2': 'It is red',
                    },
                    confidence: 0.95,
                },
            },
        });

        const client = new Client(kDefaultSettings);
        const results = await client.decide({
            context: 'The horse is red',
            decisions: [
                {
                    type: 'noul',
                    instructions: 'Is the horse blue?',
                    criteria: {
                        truthy: 'The horse is blue',
                        falsy: 'The horse is not blue',
                    },
                },
                {
                    type: 'choice',
                    instructions: 'What colour does the horse have?',
                    criteria: {
                        blue: 'The horse is blue',
                        dark: 'The horse has a dark colour',
                        sparkling: 'The horse sparkles',
                    },
                },
                {
                    type: 'score',
                    instructions: 'What can we say about this product?',
                    criteria: [
                        'It is an animal',
                        'It glows in the dark',
                        'It is red',
                    ],
                },
            ],
        });

        expectTypeOf(results[0]).toEqualTypeOf<{
            type: 'noul';
            decision: boolean;
            noul: number;
            confidence: number;
        }>();
        expectTypeOf(results[1]).toEqualTypeOf<{
            type: 'choice';
            decision: 'blue' | 'dark' | 'sparkling';
            probabilities: { blue: number; dark: number; sparkling: number };
            confidence: number;
        }>();
        expectTypeOf(results[2]).toEqualTypeOf<{
            type: 'score';
            score: number;
            probabilities: number[];
            confidence: number;
        }>();

        expect(results).toEqual([
            { type: 'noul', decision: false, noul: 0.03, confidence: 0.97 },
            {
                type: 'choice',
                decision: 'dark',
                probabilities: { blue: 0.07, dark: 0.81, sparkling: 0.12 },
                confidence: 0.71,
            },
            {
                type: 'score',
                score: 1.12,
                probabilities: [ 0.47, 0.01, 0.52 ],
                confidence: 0.95,
            },
        ]);

        expect(mockCreateDecision).toHaveBeenCalledWith({
            model: 'gemini-decision-1',
            input: 'The horse is red',
            questions: {
                '0': {
                    type: 'noul',
                    instructions: 'Is the horse blue?',
                    criteria: {
                        true_description: 'The horse is blue',
                        false_description: 'The horse is not blue',
                    },
                },
                '1': {
                    type: 'choice',
                    instructions: 'What colour does the horse have?',
                    criteria: {
                        blue: 'The horse is blue',
                        dark: 'The horse has a dark colour',
                        sparkling: 'The horse sparkles',
                    },
                },
                '2': {
                    type: 'score',
                    instructions: 'What can we say about this product?',
                    criteria: [
                        'It is an animal',
                        'It glows in the dark',
                        'It is red',
                    ],
                },
            },
        });

        expect(await client.decide({ context: 'Unused', decisions: [] })).toEqual([]);
        expect(mockCreateDecision).toHaveBeenCalledTimes(1);
    });

    it('surfaces blocked and malformed decision responses as errors', async () => {
        const client = new Client(kDefaultSettings);

        mockCreateDecision.mockResolvedValueOnce({
            prompt_feedback: {
                block_reason: 'SAFETY',
                block_reason_message: 'Blocked by safety policy',
            },
        });

        await expect(client.decide({
            context: 'Unsafe input',
            decisions: [ { type: 'noul', instructions: 'Is this safe?' } ],
        })).rejects.toThrow('Decision request was blocked: Blocked by safety policy');

        mockCreateDecision.mockResolvedValueOnce({ answers: {} });

        await expect(client.decide({
            context: 'The horse is red',
            decisions: [ { type: 'noul', instructions: 'Is the horse red?' } ],
        })).rejects.toThrow('Missing or mismatched decision answer at index 0.');
    });

    it('instruments real @google/genai decision requests end-to-end', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            answers: {
                '0': { type: 'noul', noul: 0.91, confidence: 0.91 },
            },
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));

        const client = new Client(kDefaultSettings);
        const { GoogleGenAI: ActualGoogleGenAI } =
            await vi.importActual<typeof import('@google/genai')>('@google/genai');
        const realAi = new ActualGoogleGenAI(capturedOptions);
        mockCreateDecision.mockImplementationOnce(params => realAi.decisions.create(params));

        const [ answer ] = await client.decide({
            context: 'The horse is red',
            decisions: [
                {
                    type: 'noul',
                    instructions: 'Is the horse red?',
                },
            ],
        });

        expect(answer).toEqual({
            type: 'noul',
            decision: true,
            noul: 0.91,
            confidence: 0.91,
        });

        const recordedInstrumentation =
            withContextSpy.mock.results.at(-1)?.value as Instrumentation | undefined;
        expect(recordedInstrumentation).toBeDefined();
        await recordedInstrumentation!.completionPromise;

        expect(recordedInstrumentation!.contextForTesting).toEqual({
            integration: 'GenAI',
            operation: 'https://generativelanguage.googleapis.com/v1beta/decisions',
            taskId: undefined,
            userId: undefined,
        });

        expect(JSON.parse(recordedInstrumentation!.statusForTesting.input!)).toEqual({
            url: 'https://generativelanguage.googleapis.com/v1beta/decisions',
            method: 'POST',
            headers: expect.objectContaining({
                'content-type': 'application/json',
                'x-goog-api-key': 'my-gemini-api-key',
            }),
            body: {
                model: 'gemini-decision-1',
                input: 'The horse is red',
                questions: {
                    '0': {
                        type: 'noul',
                        instructions: 'Is the horse red?',
                    },
                },
            },
        });

        expect(JSON.parse(recordedInstrumentation!.statusForTesting.output!)).toEqual({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: {
                answers: {
                    '0': { type: 'noul', noul: 0.91, confidence: 0.91 },
                },
            },
        });
    });
});
