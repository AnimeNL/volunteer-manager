// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import type { Directives } from 'mdast-util-directive';
import type { Node } from 'unist';
import type { Parent, Text } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin that takes container directives (:::foo) and assigns the <admonition> tag to them.
 *
 * Note that nomenclature is as follows:
 *
 *   containerDirective
 *       :::info
 *       contents
 *       :::
 *
 *   leafDirective
 *
 *       ::remote[identifier]
 *
 *   textDirective
 *
 *       :text
 *
 * We use container directives for alerts, and leaf directives for the remote content functionality.
 * At this point text directives are not used, and they cause parsing issues with e.g. times.
 */
export function remarkAdmonitionsPlugin() {
    return (tree: Node) => {
        visit(tree, (node: any, index?: number, parent?: Parent) => {
            if (node.type !== 'containerDirective' &&
                node.type !== 'leafDirective' &&
                node.type !== 'textDirective')
            {
                return;
            }

            const directive = node as Directives;

            // Replace text directives back with their original text, as we won't be consuming them.
            if (directive.type === 'textDirective' && parent && typeof index === 'number') {
                const replacement: Text = {
                    type: 'text',
                    value: `:${directive.name}`
                };

                parent.children.splice(index, 1, replacement, ...(directive.children || []));
                return;
            }

            if (!node.data)
                node.data = {};

            const data = node.data;
            const tagName =
                node.type === 'containerDirective' ? 'admonition'
                                                    : 'remote';

            data.hName = tagName;
            data.hProperties = {
                type: node.name, // 'note', 'warning', 'tip', etc.
                ...(node.attributes || {}),
            };
        });
    };
}
