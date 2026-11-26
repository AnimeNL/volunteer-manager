// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useSyncExternalStore } from 'react';

/**
 * Non-standard Chromium event fired when the browser determines the web app is installable.
 */
interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
    if (deferredPrompt === event)
        return;

    deferredPrompt = event;
    for (const listener of listeners)
        listener();
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        setDeferredPrompt(event as BeforeInstallPromptEvent);
    });

    window.addEventListener('appinstalled', () => {
        setDeferredPrompt(null);
    });
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): boolean {
    return deferredPrompt !== null;
}

function getServerSnapshot(): boolean {
    return false;
}

async function promptInstall(): Promise<void> {
    const prompt = deferredPrompt;
    if (!prompt)
        return;

    setDeferredPrompt(null);

    try {
        await prompt.prompt();
        await prompt.userChoice;
    } catch {
        // Ignore rejections when the browser cancels or invalidates the install prompt.
    }
}

/**
 * Tracks browser PWA installability via `beforeinstallprompt` and `appinstalled`, exposing whether
 * an install prompt is currently available and a callback to trigger it.
 */
export function useInstallPrompt(): {
    canInstall: boolean;
    install: () => Promise<void>;
} {
    const canInstall = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return { canInstall, install: promptInstall };
}
