// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

if (typeof window !== 'undefined') {
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (elt, ...args) {
        let style: CSSStyleDeclaration;
        try {
            style = originalGetComputedStyle.call(this, elt, ...args);
        } catch {
            return new Proxy({}, {
                get(target, prop) {
                    if (prop === 'getPropertyValue') {
                        return () => '';
                    }
                    return '';
                }
            }) as any;
        }

        return new Proxy(style, {
            get(target, prop, receiver) {
                try {
                    const value = Reflect.get(target, prop, receiver);
                    if (typeof value === 'function') {
                        return value.bind(target);
                    }
                    return value;
                } catch {
                    if (prop === 'getPropertyValue') {
                        return () => '';
                    }
                    return '';
                }
            }
        });
    };

    // Workaround for a bug introduced in jsdom 30.1.0: when a focused element is removed from the
    // DOM, jsdom internally tracks the viewport as the Document. However, subsequent focus events
    // erroneously pass this Document as event.relatedTarget (violating W3C UI Events specs where
    // relatedTarget must be an Element or null). Material UI's <FocusTrap> stores relatedTarget to
    // restore focus on unmount and calls .focus() on it, throwing because Document.focus does not
    // exist. Normalizing Document to null restores standard browser behavior.
    const originalRelatedTarget =
        Object.getOwnPropertyDescriptor(window.FocusEvent.prototype, 'relatedTarget')?.get;
    if (originalRelatedTarget) {
        Object.defineProperty(window.FocusEvent.prototype, 'relatedTarget', {
            get() {
                const target = originalRelatedTarget.call(this);
                return target instanceof Document ? null : target;
            },
            configurable: true,
            enumerable: true,
        });
    }
}

vi.mock('next/navigation', () => {
    class HTTPAccessFallbackError extends Error {
        digest: string;
        constructor(status: number) {
            super(`NEXT_HTTP_ERROR_FALLBACK;${status}`);
            this.digest = `NEXT_HTTP_ERROR_FALLBACK;${status}`;
        }
    }

    return {
        useRouter: () => ({
            push: vi.fn(),
            replace: vi.fn(),
            refresh: vi.fn(),
            back: vi.fn(),
            forward: vi.fn(),
            prefetch: vi.fn(),
        }),
        usePathname: () => '/',
        useSearchParams: () => new URLSearchParams(),
        useParams: () => ({}),
        unauthorized: () => {
            throw new HTTPAccessFallbackError(401);
        },
        forbidden: () => {
            throw new HTTPAccessFallbackError(403);
        },
        notFound: () => {
            throw new HTTPAccessFallbackError(404);
        },
        redirect: (url: string) => {
            throw new Error(`Redirect to ${url}`);
        },
    };
});

vi.mock('server-only', () => {
    return {};
});

vi.mock('@components/Markdown', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@components/Markdown')>();
    return {
        ...actual,
        Markdown: (props: any) => props.content,
    };
});
