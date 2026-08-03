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


