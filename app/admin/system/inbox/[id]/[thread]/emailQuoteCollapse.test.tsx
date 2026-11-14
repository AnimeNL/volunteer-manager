// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { findCollapsibleHtmlNodes, splitPlainTextQuote } from './emailQuoteCollapse';

function parseBody(html: string): HTMLElement {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
    return doc.body;
}

describe('emailQuoteCollapse', () => {
    describe('findCollapsibleHtmlNodes', () => {
        it('collapses Gmail, Thunderbird, and Apple Mail trailing quote blocks', () => {
            const gmailBody = parseBody(`
                <div>Sounds great, thank you!</div>
                <div class="gmail_quote gmail_quote_container">
                    <div class="gmail_attr">On Thu, Apr 9, 2026, Alice wrote:</div>
                    <blockquote class="gmail_quote">Earlier message</blockquote>
                </div>
            `);
            const gmailNodes = findCollapsibleHtmlNodes(gmailBody);
            expect(gmailNodes).toHaveLength(1);
            expect(gmailNodes[0].classList.contains('gmail_quote_container')).toBe(true);

            const thunderbirdBody = parseBody(`
                <p>Prima schema!</p>
                <div class="moz-cite-prefix">Op 14-03-2026 om 17:55 schreef Martijn:</div>
                <blockquote type="cite"><p>Origineel bericht</p></blockquote>
            `);
            const thunderbirdNodes = findCollapsibleHtmlNodes(thunderbirdBody);
            expect(thunderbirdNodes).toHaveLength(2);
            expect(thunderbirdNodes[0].className).toBe('moz-cite-prefix');
            expect(thunderbirdNodes[1].tagName).toBe('BLOCKQUOTE');

            const appleMailBody = parseBody(`
                Top!
                <div>
                    <div dir="ltr">Gr, Tim</div>
                    <div dir="ltr">
                        <br><blockquote type="cite">Op 9 apr schreef Peter:</blockquote>
                    </div>
                    <blockquote type="cite"><div>Quoted history</div></blockquote>
                </div>
            `);
            const appleNodes = findCollapsibleHtmlNodes(appleMailBody);
            expect(appleNodes).toHaveLength(2);
            expect(appleNodes[0].tagName).toBe('DIV');
            expect(appleNodes[1].tagName).toBe('BLOCKQUOTE');
        });

        it('collapses Outlook border-top dividers, trailing siblings, and empty spacers', () => {
            const outlookBody = parseBody(`
                <style>p.MsoNormal { margin: 0cm; }</style>
                <div class="WordSection1">
                    <p class="MsoNormal">Hey Peter,</p>
                    <p class="MsoNormal">&nbsp;</p>
                    <div style="border:none;border-top:solid #E1E1E1 1.0pt;padding-top:3.0pt">
                        <p class="MsoNormal"><b>Van:</b> Tim<br><b>Verzonden:</b> vrijdag</p>
                    </div>
                    <p class="MsoNormal">Oudere paragraaf 1</p>
                    <p class="MsoNormal">Oudere paragraaf 2</p>
                </div>
            `);

            const nodes = findCollapsibleHtmlNodes(outlookBody);
            expect(nodes).toHaveLength(4);
            expect(nodes[0].textContent?.trim()).toBe('');
            expect(nodes[1].textContent).toContain('Van:');
            expect(nodes[2].textContent).toBe('Oudere paragraaf 1');
            expect(nodes[3].textContent).toBe('Oudere paragraaf 2');
        });

        it('preserves inline quotes followed by a reply and keeps quote-only mail visible', () => {
            const inlineReplyBody = parseBody(`
                <blockquote type="cite">Can I bring a prop sword?</blockquote>
                <p>Yes, provided it has no sharp metal edges.</p>
                <blockquote type="cite">Full earlier thread history</blockquote>
            `);

            const inlineNodes = findCollapsibleHtmlNodes(inlineReplyBody);
            expect(inlineNodes).toHaveLength(1);
            expect(inlineNodes[0].textContent).toBe('Full earlier thread history');

            const quoteOnlyBody = parseBody(`
                <style>body { color: black; }</style>
                <blockquote type="cite">Forwarded quote with no commentary above</blockquote>
            `);
            expect(findCollapsibleHtmlNodes(quoteOnlyBody)).toHaveLength(0);
        });
    });

    describe('splitPlainTextQuote', () => {
        it('splits trailing > quotes together with their attribution line', () => {
            const input = [
                'Hi Alice,',
                '',
                'Friday morning works for us!',
                '',
                'On Thu, Apr 9, 2026 at 7:12 AM Alice <alice@example.com> wrote:',
                '> Hey team,',
                '>',
                '> Does Friday morning work?',
            ].join('\n');

            expect(splitPlainTextQuote(input)).toEqual({
                mainText: 'Hi Alice,\n\nFriday morning works for us!',
                quotedText: [
                    'On Thu, Apr 9, 2026 at 7:12 AM Alice <alice@example.com> wrote:',
                    '> Hey team,',
                    '>',
                    '> Does Friday morning work?',
                ].join('\n'),
            });
        });

        it('splits Outlook plain-text separator blocks while keeping inline > quotes', () => {
            const outlookText = [
                'See below for details.',
                '',
                '-----Original Message-----',
                'From: Volunteer <v@example.com>',
                'Sent: Monday',
                '',
                'Hello!',
            ].join('\n');

            expect(splitPlainTextQuote(outlookText)).toEqual({
                mainText: 'See below for details.',
                quotedText: [
                    '-----Original Message-----',
                    'From: Volunteer <v@example.com>',
                    'Sent: Monday',
                    '',
                    'Hello!',
                ].join('\n'),
            });

            const inlineOnly = '> Question?\nAnswer right below it.';
            expect(splitPlainTextQuote(inlineOnly)).toEqual({
                mainText: inlineOnly,
            });
        });
    });
});
