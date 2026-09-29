import { AlphaType, ColorType, Skia, type SkData } from '@shopify/react-native-skia';
import { Image } from 'expo-image';

import { meanOpaqueLuminance } from '@/lib/immersive-color';
import { USER_AGENT } from '@/lib/wikidata/client';

/** A logo thumbnail is tens of KB; this is a backstop, not a budget. */
const MAX_BYTES = 2_000_000;
const MAX_PIXELS = 4_000_000;

/** Pixels sampled per logo. Every pixel of a 960px render is ~250k; a tenth of that is plenty. */
const TARGET_SAMPLES = 25_000;

/**
 * How light a logo's ink is: the mean luminance of its opaque pixels, or null
 * when it could not be read.
 *
 * The studio page draws a logo as it is when that ink holds 3:1 against the
 * page and as a light silhouette otherwise (`logoNeedsLightInk`) — which has to
 * be measured, because Commons' logos are drawn for white pages: FromSoftware's
 * is pure black and would vanish on the studio page's dark one.
 *
 * Decoded with Skia, which the app already carries and which Expo Go ships at
 * the pinned version — a PNG needs inflating, and `jpeg-js` reads only JPEG.
 * Measured once per studio, when the logo is first resolved; the number is
 * cached with it. `logo-luminance.web.ts` is the web build's, which has no Skia.
 *
 * ## One download, not two
 *
 * The bytes are read from expo-image's own disk cache, downloaded into it
 * first: the entry `<StudioIdentity>` then draws the logo from. Measuring used
 * to `fetch` the file and the `<Image>` downloaded it again. Where the cache
 * cannot hand the file over — it resolves no path — the logo is fetched as
 * before, which costs the second download and nothing else.
 *
 * Every request carries the app's User-Agent: Wikimedia's media host refuses a
 * generic client with a 403.
 */
export async function measureLogoLuminance(url: string): Promise<number | null> {
  try {
    const data = (await fromImageCache(url)) ?? (await downloaded(url));
    if (!data) return null;

    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      data.dispose();
      return null;
    }

    try {
      const width = image.width();
      const height = image.height();
      if (width * height > MAX_PIXELS) return null;
      const pixels = image.readPixels(0, 0, {
        width,
        height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!(pixels instanceof Uint8Array)) return null;
      return meanOpaqueLuminance(
        pixels,
        Math.max(1, Math.floor((width * height) / TARGET_SAMPLES))
      );
    } finally {
      image.dispose();
      data.dispose();
    }
  } catch {
    /* Unmeasured is an answer: the logo is drawn light, which is always legible. */
    return null;
  }
}

/**
 * The logo's bytes from expo-image's disk cache, after downloading them into
 * it — keyed by the URL, which is the key `<StudioIdentity>` draws it under.
 */
async function fromImageCache(url: string): Promise<SkData | null> {
  try {
    const cached = await Image.prefetch(url, {
      cachePolicy: 'disk',
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!cached) return null;
    const path = await Image.getCachePathAsync(url);
    if (!path) return null;
    return await Skia.Data.fromURI(path.startsWith('file://') ? path : `file://${path}`);
  } catch {
    return null;
  }
}

/** The logo fetched directly, when the image cache could not hand it over. */
async function downloaded(url: string): Promise<SkData | null> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) return null;
  return Skia.Data.fromBytes(new Uint8Array(buffer));
}
