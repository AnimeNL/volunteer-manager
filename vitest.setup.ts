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
