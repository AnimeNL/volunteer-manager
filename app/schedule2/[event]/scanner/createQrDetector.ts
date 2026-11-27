// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

/**
 * Minimal subset of the W3C Barcode Detection API used by the QR scanner.
 */
export interface QrDetector {
    detect(source: HTMLVideoElement | ImageBitmap | Blob): Promise<string | undefined>;
}

/**
 * Browser-native `BarcodeDetector` constructor shape (not yet in all TypeScript DOM libs).
 */
interface NativeBarcodeDetector {
    detect(source: ImageBitmapSource): Promise<ReadonlyArray<{ rawValue?: string }>>;
}

interface NativeBarcodeDetectorConstructor {
    new (options?: { formats?: string[] }): NativeBarcodeDetector;
    getSupportedFormats(): Promise<string[]>;
}

let cachedDetectorPromise: Promise<QrDetector> | undefined;

/**
 * Checks whether the browser provides a native `BarcodeDetector` that supports QR codes.
 */
async function createNativeQrDetector(): Promise<QrDetector | undefined> {
    const NativeCtor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorConstructor })
        .BarcodeDetector;

    if (typeof NativeCtor !== 'function')
        return undefined;

    try {
        const formats = await NativeCtor.getSupportedFormats();
        if (!formats.includes('qr_code'))
            return undefined;

        const detector = new NativeCtor({ formats: [ 'qr_code' ] });
        return {
            async detect(source) {
                const results = await detector.detect(source);
                return results[0]?.rawValue || undefined;
            },
        };
    } catch {
        return undefined;
    }
}

/**
 * Creates a `QrDetector` backed by `barcode-detector`'s `zxing-wasm` ponyfill, loading the
 * WebAssembly binary from our own origin rather than an external CDN.
 */
async function createPonyfillQrDetector(): Promise<QrDetector> {
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
    const wasmUrl = new URL('zxing-wasm/reader/zxing_reader.wasm', import.meta.url).href;

    prepareZXingModule({
        overrides: {
            locateFile: (path: string, prefix: string) =>
                (path.endsWith('.wasm') ? wasmUrl : prefix + path),
        },
    });

    const detector = new BarcodeDetector({ formats: [ 'qr_code' ] });
    return {
        async detect(source) {
            const results = await detector.detect(source);
            return results[0]?.rawValue || undefined;
        },
    };
}

/**
 * Returns a cached `QrDetector` instance, preferring the browser's native `BarcodeDetector` API
 * when QR code scanning is supported and falling back to the self-hosted `zxing-wasm` ponyfill.
 */
export function getQrDetector(): Promise<QrDetector> {
    if (!cachedDetectorPromise) {
        cachedDetectorPromise = (async () => {
            const native = await createNativeQrDetector();
            return native ?? await createPonyfillQrDetector();
        })().catch(error => {
            cachedDetectorPromise = undefined;
            throw error;
        });
    }

    return cachedDetectorPromise;
}
