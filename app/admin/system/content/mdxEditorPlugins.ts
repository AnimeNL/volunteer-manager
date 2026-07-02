// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { type MdastImportVisitor, realmPlugin, addImportVisitor$ } from '@mdxeditor/editor';
import { $createParagraphNode, $createTextNode, ElementNode } from 'lexical';

/**
 * Visitor that considers unrecognised nodes of various types and transforms them in textual
 * representations. Note that MDXEditor may silently escape the resulting MDX.
 *
 * @see https://github.com/mdx-editor/editor/issues/95#issuecomment-1732225694
 * @see https://codesandbox.io/s/catch-all-plugin-c7d62v?file=/src/App.tsx:729-735
 */
const unrecognisedNodeVisitor: MdastImportVisitor<any> = {
    testNode: (mdastNode) => {
        return [ 'mdxFlowExpression', 'mdxTextExpression' ].includes(mdastNode.type);
    },
    visitNode: ({ mdastNode, lexicalParent }) => {
        if (!(lexicalParent instanceof ElementNode))
            throw new Error('Expected the lexical parent to be an element, got a node instead');

        const lexicalParentElement = lexicalParent as ElementNode;
        switch (mdastNode.type) {
            case 'mdxFlowExpression': {
                const paragraph = $createParagraphNode();
                paragraph.append($createTextNode(`{${mdastNode.value}}`));

                lexicalParentElement.append(paragraph);
                break;
            }
            case 'mdxTextExpression':
                lexicalParentElement.append($createTextNode(`{${mdastNode.value}}`));
                break;
        }
    },
};

/**
 * The `unrecognisedNodePlugin` recognises nodes that aren't being handled by the MDXEditor itself
 * and would cause an exception to be thrown, and maintains their textual representation instead.
 */
export const unrecognisedNodePlugin = realmPlugin({
    init: (realm) => {
        realm.pub(addImportVisitor$, unrecognisedNodeVisitor);
    },
});
