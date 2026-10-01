/**
 * Making a feed cheap to parse, without changing what is read from it.
 *
 * Pure — no React Native, no network — so `npm test` can hold `lightenFeed` to
 * its one promise: a feed parsed after it reads the same as before it.
 */

export function firstImgInHtml(html: string | null): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

/**
 * A feed's article bodies reduced to what this app reads out of them.
 *
 * Feeds carry whole articles, as HTML, and this app reads one thing out of
 * them — the first `<img>` of `content:encoded`, as the last place to look for
 * a cover. Parsed whole they are most of the work: PC Gamer's feed is 5.1 MB
 * and carries every article twice, once as `content:encoded` and again as
 * `dc:content`, and `fast-xml-parser` walked all of it on the JS thread every
 * time Home's news went stale — which on a cold start is just as the first
 * screen becomes something you can touch.
 *
 * So the bodies are cut out of the string *before* it is parsed, by `indexOf`
 * (a native scan) rather than a regex: `content:encoded` becomes a stub holding
 * only the image it would have yielded, and `dc:content`, which nothing reads,
 * goes. `imageFrom` reads the stub exactly as it read the original, so what
 * each article shows does not change — `feed-lighten.test.ts` holds it to that,
 * and the four live feeds parsed identically before and after.
 *
 * A body is CDATA (raw HTML) in most feeds and entity-escaped in some; both are
 * handled. Anything malformed — a body with no closing tag — is left as it is
 * for the parser, which was going to see it anyway.
 */
export function lightenFeed(xml: string): string {
  return cutElements(cutElements(xml, 'content:encoded', imageStub), 'dc:content', () => '');
}

/**
 * The stub a `content:encoded` body is replaced with.
 *
 * A body with no image still answers, and answers "none": `imageFrom` asks the
 * description only when there is no body at all, so an imageless body is kept
 * as a non-empty stub rather than dropped.
 */
function imageStub(xml: string, start: number, end: number): string {
  const image = firstImageBetween(xml, start, end);
  return image
    ? `<content:encoded><![CDATA[<img src="${image}">]]></content:encoded>`
    : '<content:encoded>-</content:encoded>';
}

/**
 * Every `<name>…</name>` in `xml` replaced by what `replace` makes of its body
 * (`xml[start, end)`). An empty `<name/>` is left alone.
 */
function cutElements(
  xml: string,
  name: string,
  replace: (xml: string, start: number, end: number) => string
): string {
  const open = `<${name}`;
  const close = `</${name}>`;
  let at = xml.indexOf(open);
  if (at < 0) return xml;

  const kept: string[] = [];
  let from = 0;
  while (at >= 0) {
    /* The name must end here: `<dc:content` is not `<dc:contentType`. */
    const next = xml.charCodeAt(at + open.length);
    const tagEnd = xml.indexOf('>', at);
    if (tagEnd < 0) break;
    if (
      !(next === 62 /* > */ || next === 47 /* / */ || next <= 32) ||
      xml.charCodeAt(tagEnd - 1) === 47
    ) {
      at = xml.indexOf(open, tagEnd);
      continue;
    }
    const end = xml.indexOf(close, tagEnd);
    if (end < 0) break;

    kept.push(xml.slice(from, at), replace(xml, tagEnd + 1, end));
    from = end + close.length;
    at = xml.indexOf(open, from);
  }
  kept.push(xml.slice(from));
  return kept.join('');
}

/** How much of an escaped body is unescaped to find a tag's `src`, before giving in and unescaping the rest. */
const ESCAPED_WINDOW = 4096;

/**
 * The first `<img src>` in `xml[start, end)`, read as raw HTML or as escaped HTML.
 *
 * Searched within the body's own slice: an `indexOf` on the whole document
 * keeps going past a body with no image, through the rest of the feed, once
 * per item. Either case of the tag is found, as the regex reading it ignores case.
 */
function firstImageBetween(xml: string, start: number, end: number): string | null {
  const body = xml.slice(start, end);

  const raw = earliest(body.indexOf('<img'), body.indexOf('<IMG'));
  if (raw >= 0) return firstImgInHtml(body.slice(raw));

  const escaped = earliest(body.indexOf('&lt;img'), body.indexOf('&lt;IMG'));
  if (escaped < 0) return null;
  /* Only a window is unescaped — the article around it never is — unless the
     tag's `src` lies past it, which is rare enough to pay for in full. */
  return (
    firstImgInHtml(unescapeXml(body.slice(escaped, escaped + ESCAPED_WINDOW))) ??
    firstImgInHtml(unescapeXml(body.slice(escaped)))
  );
}

function earliest(a: number, b: number): number {
  if (a < 0) return b;
  if (b < 0) return a;
  return Math.min(a, b);
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
