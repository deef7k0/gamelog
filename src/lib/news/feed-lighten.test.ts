import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { XMLParser } from 'fast-xml-parser';

import { firstImgInHtml, lightenFeed } from './feed-lighten.ts';

/**
 * Run with `npm test`.
 *
 * `lightenFeed` has one promise: a feed reads the same after it as before. So
 * every case here is parsed twice — as served, and lightened — with the parser
 * configuration `rss.ts` uses, and the fields an article is built from must
 * agree, the image above all. What it changes is only how much there is to
 * parse.
 */

/* `rss.ts`'s parser, option for option. */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['item', 'entry'].includes(name),
});

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    if (typeof node['#text'] === 'string') return node['#text'].trim() || null;
  }
  return null;
}

/** What `rss.ts` reads out of each item, with the HTML-image fallback it uses. */
function read(xml: string) {
  const root = parser.parse(xml) as Record<string, any>;
  const items: Record<string, unknown>[] = root?.rss?.channel?.item ?? [];
  return items.map((item) => ({
    title: text(item.title),
    link: text(item.link),
    guid: text(item.guid),
    description: text(item.description),
    pubDate: text(item.pubDate),
    image: firstImgInHtml(text(item['content:encoded']) ?? text(item.description)),
  }));
}

function feed(...items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel><title>Feed</title>
    ${items.map((item) => `<item>${item}</item>`).join('\n    ')}
  </channel>
</rss>`;
}

const ARTICLE = '<p>Paragraph. </p>'.repeat(400);

describe('lightenFeed', () => {
  it('keeps the first image of a CDATA body and drops the rest of it', () => {
    const xml = feed(
      `<title>One</title><link>https://a.test/1</link>
       <content:encoded><![CDATA[<p>Lead</p><img class="x" src="https://img.test/first.jpg?w=1&amp;h=2" /><img src="https://img.test/second.jpg">${ARTICLE}]]></content:encoded>`
    );
    const light = lightenFeed(xml);
    assert.deepEqual(read(light), read(xml));
    assert.equal(read(light)[0].image, 'https://img.test/first.jpg?w=1&amp;h=2');
    assert.ok(light.length < xml.length / 10, 'the article body is gone');
  });

  it('reads the image out of an entity-escaped body', () => {
    const escaped = `&lt;p&gt;Lead&lt;/p&gt;&lt;img src=&quot;https://img.test/e.jpg?w=1&amp;amp;h=2&quot;&gt;${ARTICLE.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
    const xml = feed(
      `<title>Two</title><link>https://a.test/2</link><content:encoded>${escaped}</content:encoded>`
    );
    const light = lightenFeed(xml);
    assert.deepEqual(read(light), read(xml));
    assert.equal(read(light)[0].image, 'https://img.test/e.jpg?w=1&amp;h=2');
  });

  it('keeps an imageless body answering "no image", as the original did', () => {
    // `imageFrom` asks the description only when there is no body at all, so a
    // body without an image means no image even when the description has one.
    const xml = feed(
      `<title>Three</title><link>https://a.test/3</link>
       <description><![CDATA[<img src="https://img.test/from-description.jpg">Summary]]></description>
       <content:encoded><![CDATA[${ARTICLE}]]></content:encoded>`
    );
    const light = lightenFeed(xml);
    assert.deepEqual(read(light), read(xml));
    assert.equal(read(light)[0].image, null);
    assert.ok(light.length < xml.length / 10, 'the article body is gone');
  });

  it('leaves the description to answer when there is no body', () => {
    const xml = feed(
      `<title>Four</title><link>https://a.test/4</link>
       <description><![CDATA[<img src="https://img.test/from-description.jpg">Summary]]></description>`
    );
    assert.deepEqual(read(lightenFeed(xml)), read(xml));
    assert.equal(read(lightenFeed(xml))[0].image, 'https://img.test/from-description.jpg');
  });

  it('handles many items, an empty element and items without a body', () => {
    const xml = feed(
      `<title>A</title><link>https://a.test/a</link><content:encoded><![CDATA[<img src="https://img.test/a.jpg">${ARTICLE}]]></content:encoded>`,
      `<title>B</title><link>https://a.test/b</link><content:encoded/>`,
      `<title>C</title><link>https://a.test/c</link><guid>c-1</guid><pubDate>Wed, 01 Oct 2026 10:00:00 GMT</pubDate>`,
      `<title>D</title><link>https://a.test/d</link><content:encoded><![CDATA[<IMG SRC="https://img.test/upper.jpg">]]></content:encoded>`,
      `<title>E</title><link>https://a.test/e</link><content:encoded><![CDATA[<img src="https://img.test/e.jpg">]]></content:encoded>`
    );
    assert.deepEqual(read(lightenFeed(xml)), read(xml));
  });

  it("drops dc:content — PC Gamer's second copy of every article — and only that", () => {
    const xml = feed(
      `<title>Twice</title><link>https://a.test/t</link>
       <dc:content><![CDATA[${ARTICLE}<img src="https://img.test/not-read.jpg">]]></dc:content>
       <dc:contentType>text/html</dc:contentType>
       <content:encoded><![CDATA[<img src="https://img.test/read.jpg">${ARTICLE}]]></content:encoded>`
    ).replace('xmlns:content=', 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content=');
    const light = lightenFeed(xml);
    assert.ok(!light.includes('<dc:content>'), 'the duplicate article is gone');
    assert.ok(
      light.includes('<dc:contentType>text/html</dc:contentType>'),
      'a longer name is untouched'
    );
    assert.deepEqual(read(light), read(xml));
    assert.equal(read(light)[0].image, 'https://img.test/read.jpg');
  });

  it('returns a feed with nothing to cut unchanged, and leaves a malformed one to the parser', () => {
    const plain = feed('<title>Plain</title><link>https://a.test/p</link>');
    assert.equal(lightenFeed(plain), plain);

    const unclosed = feed('<title>Broken</title><content:encoded><![CDATA[<img src="x.jpg">');
    assert.equal(lightenFeed(unclosed), unclosed);
  });
});
