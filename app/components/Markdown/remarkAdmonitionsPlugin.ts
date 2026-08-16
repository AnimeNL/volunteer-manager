// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import type { Node } from 'unist';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin that takes container directives (:::foo) and assigns the <admonition> tag to them.
 */
export function remarkAdmonitionsPlugin() {
    return (tree: Node) => {
        visit(tree, (node: any) => {
            if (node.type === 'containerDirective' ||
                node.type === 'leafDirective' ||
                node.type === 'textDirective')
            {
                const data = node.data || (node.data = {});
                const tagName = node.name === 'remote' ? 'remote' : 'admonition';

                data.hName = tagName;
                data.hProperties = {
                    type: node.name, // 'note', 'warning', 'tip', etc.
                    ...(node.attributes || {}),
                };
            }
        });
    };
}
