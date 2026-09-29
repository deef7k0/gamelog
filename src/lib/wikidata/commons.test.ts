import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  currentLogosFirst,
  isPublicDomainLogo,
  isStudioLogoFile,
  logoFileNames,
  mediaUrl,
  namesMatch,
  pickVerifiedLogo,
  plainText,
  readCommonsFile,
  verifyLicense,
  type CommonsFile,
} from './commons.ts';

/* extmetadata exactly as the live API returned it (values only). */
const MOJANG_PD = {
  License: 'pd',
  LicenseShortName: 'Public domain',
  UsageTerms: 'Public domain',
  Copyrighted: 'False',
  AttributionRequired: 'false',
  Restrictions: 'trademarked',
  Artist: 'Bold',
  Credit:
    '<a rel="nofollow" class="external free" href="https://logos.fandom.com/wiki/Mojang_Studios">https://logos.fandom.com/wiki/Mojang_Studios</a>',
  Categories:
    'With trademark|PD textlogo|SVG simple text logos|Mojang Studios logos|Images from Logopedia',
};
const CC0 = {
  License: 'cc0',
  LicenseShortName: 'CC0',
  UsageTerms: 'Creative Commons Zero, Public Domain Dedication',
  LicenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
  Copyrighted: 'True',
  AttributionRequired: 'false',
  Restrictions: '',
};
const CC_BY_SA = {
  License: 'cc-by-sa-4.0',
  LicenseShortName: 'CC BY-SA 4.0',
  UsageTerms: 'Creative Commons Attribution-Share Alike 4.0',
  LicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  Copyrighted: 'True',
  AttributionRequired: 'true',
};
/* Flickr Commons: "No known copyright restrictions" — no licence code at all. */
const NO_KNOWN_RESTRICTIONS = {
  LicenseShortName: 'No restrictions',
  UsageTerms: 'No known copyright restrictions',
  Copyrighted: 'True',
  AttributionRequired: 'false',
};
/* English Wikipedia's "File:Naughty Dog Logo.svg" — a local, fair-use upload. */
const NAUGHTY_DOG_FAIR_USE = {
  LicenseShortName: 'Fair use',
  UsageTerms: 'Fair use',
  NonFree: 'true',
  Copyrighted: 'True',
};

function file(overrides: Partial<CommonsFile> = {}): CommonsFile {
  return {
    title: 'File:Mojang Studios Logo (2020, wide).svg',
    mime: 'image/svg+xml',
    thumbUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Mojang_Studios_Logo_%282020%2C_wide%29.svg/960px-Mojang_Studios_Logo_%282020%2C_wide%29.svg.png',
    thumbWidth: 800,
    thumbHeight: 228,
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Mojang_Studios_Logo_(2020,_wide).svg',
    metadata: MOJANG_PD,
    categories: MOJANG_PD.Categories.split('|'),
    ...overrides,
  };
}

describe('verifyLicense', () => {
  it('accepts public domain, on the licence code and nothing else', () => {
    assert.deepEqual(verifyLicense(MOJANG_PD), {
      license: 'public-domain',
      licenseName: 'Public domain',
      attributionRequired: false,
    });
  });

  it('accepts CC0, whose waiver legitimately says Copyrighted: True', () => {
    assert.equal(verifyLicense(CC0)?.license, 'cc0');
  });

  it('rejects a free licence that is not public domain', () => {
    assert.equal(verifyLicense(CC_BY_SA), null);
    assert.equal(
      verifyLicense({ ...CC_BY_SA, License: 'cc-by-4.0', LicenseShortName: 'CC BY 4.0' }),
      null
    );
  });

  it('rejects "no known copyright restrictions", which carries no licence code', () => {
    assert.equal(verifyLicense(NO_KNOWN_RESTRICTIONS), null);
  });

  it('rejects fair use and anything marked non-free, even if it claims pd', () => {
    assert.equal(verifyLicense(NAUGHTY_DOG_FAIR_USE), null);
    assert.equal(verifyLicense({ ...MOJANG_PD, NonFree: 'true' }), null);
  });

  it('rejects missing, contradictory or mismatched metadata', () => {
    assert.equal(verifyLicense({}), null);
    assert.equal(verifyLicense({ ...MOJANG_PD, License: '' }), null);
    /* A pd code on a file that says it is copyrighted contradicts itself. */
    assert.equal(verifyLicense({ ...MOJANG_PD, Copyrighted: 'True' }), null);
    assert.equal(verifyLicense({ ...MOJANG_PD, Copyrighted: '' }), null);
    assert.equal(verifyLicense({ ...MOJANG_PD, LicenseShortName: 'CC BY-SA 4.0' }), null);
    assert.equal(verifyLicense({ ...CC0, LicenseShortName: 'CC BY 4.0', LicenseUrl: '' }), null);
  });

  it('ignores the words in titles and descriptions entirely', () => {
    assert.equal(
      isPublicDomainLogo({
        ImageDescription: 'Free public domain logo',
        LicenseShortName: 'Public domain',
      }),
      false
    );
  });
});

describe('reading and choosing files', () => {
  it('reads a page from the API and refuses URLs off Wikimedia’s media host', () => {
    const page = {
      pageid: 141253257,
      ns: 6,
      title: 'File:Valve logo.svg',
      imagerepository: 'local',
      imageinfo: [
        {
          mime: 'image/svg+xml',
          thumburl:
            'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Valve_logo.svg/960px-Valve_logo.svg.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail',
          thumbwidth: 800,
          thumbheight: 223,
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Valve_logo.svg',
          extmetadata: { License: { value: 'pd', source: 'commons-templates' } },
        },
      ],
    };
    const read = readCommonsFile(page);
    assert.equal(
      read?.thumbUrl,
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Valve_logo.svg/960px-Valve_logo.svg.png'
    );
    assert.equal(read?.metadata.License, 'pd');
    assert.equal(readCommonsFile({ title: 'File:X.svg', missing: '' }), null);
    assert.equal(readCommonsFile('junk'), null);

    assert.equal(mediaUrl('https://evil.example.com/logo.png'), null);
    assert.equal(mediaUrl('http://upload.wikimedia.org/logo.png'), null);
    assert.equal(
      mediaUrl('https://upload.wikimedia.org/a/b.png?utm_source=x&width=5'),
      'https://upload.wikimedia.org/a/b.png?width=5'
    );
  });

  it('picks the first verified file, preferring a transparent format', () => {
    const jpeg = file({ title: 'File:Studio logo.jpg', mime: 'image/jpeg' });
    const svg = file();
    assert.equal(pickVerifiedLogo([jpeg, svg])?.fileName, 'Mojang Studios Logo (2020, wide).svg');
    assert.equal(pickVerifiedLogo([jpeg])?.fileName, 'Studio logo.jpg');
  });

  it('returns null rather than an unverified logo', () => {
    assert.equal(pickVerifiedLogo([file({ metadata: CC_BY_SA })]), null);
    assert.equal(pickVerifiedLogo([file({ thumbUrl: null })]), null);
    assert.equal(pickVerifiedLogo([file({ mime: 'application/pdf' })]), null);
    assert.equal(pickVerifiedLogo([]), null);
  });

  it('keeps the source and attribution, as plain text', () => {
    const logo = pickVerifiedLogo([file()]);
    assert.equal(logo?.license, 'public-domain');
    assert.equal(logo?.restrictions, 'trademarked');
    assert.equal(logo?.credit, 'https://logos.fandom.com/wiki/Mojang_Studios');
    assert.equal(
      logo?.sourcePage,
      'https://commons.wikimedia.org/wiki/File:Mojang_Studios_Logo_(2020,_wide).svg'
    );
    assert.equal(logo?.attributionRequired, false);
    assert.equal(
      plainText('Unknown author<span style="display: none;">Unknown author</span>'),
      'Unknown author'
    );
  });
});

describe('logoFileNames (Wikidata P154)', () => {
  const text = (value: string) => ({ snaktype: 'value', datavalue: { type: 'string', value } });
  const time = {
    snaktype: 'value',
    datavalue: { value: { time: '+2020-05-17T00:00:00Z', precision: 11 } },
  };

  it('takes the current logo at the best rank, never a retired one (Mojang Studios)', () => {
    const claims = {
      P154: [
        {
          mainsnak: text('Mojang Studios Logo (2020, wide).svg'),
          qualifiers: { P580: [time] },
          rank: 'preferred',
        },
        {
          mainsnak: text('Mojang textlogo (2013-2020).svg'),
          qualifiers: { P582: [time] },
          rank: 'normal',
        },
        {
          mainsnak: text('Mojang textlogo (2011-2013).svg'),
          qualifiers: { P582: [time] },
          rank: 'normal',
        },
      ],
    };
    assert.deepEqual(logoFileNames(claims), ['Mojang Studios Logo (2020, wide).svg']);
  });

  it('uses normal rank when nothing is preferred, and skips deprecated statements', () => {
    const claims = {
      P154: [
        { mainsnak: text('Fromsoftware logo.svg'), rank: 'normal' },
        { mainsnak: text('Wrong logo.svg'), rank: 'deprecated' },
      ],
    };
    assert.deepEqual(logoFileNames(claims), ['Fromsoftware logo.svg']);
    assert.deepEqual(logoFileNames({}), []);
  });
});

describe('matching a searched file to the studio', () => {
  const found = (title: string, categories: string[]) => file({ title, categories });

  it('accepts a file titled and categorised as the studio’s logo', () => {
    assert.equal(
      isStudioLogoFile(found('File:Valve logo.svg', ['Valve Corporation logos']), 'Valve'),
      true
    );
    assert.equal(
      isStudioLogoFile(
        found('File:Supergiant Games logo 2color.svg', ['Supergiant Games']),
        'Supergiant Games'
      ),
      false,
      'a category that is not a logos category is not enough'
    );
  });

  it('accepts a title that adds only a variant, a colour, a year or a legal suffix', () => {
    const cats = ['Mojang Studios logos'];
    assert.equal(
      isStudioLogoFile(found('File:Mojang Studios Logo (2020, wide).svg', cats), 'Mojang Studios'),
      true
    );
    assert.equal(
      isStudioLogoFile(
        found('File:Valve Corporation old logo.svg', ['Valve Corporation logos']),
        'Valve'
      ),
      true
    );
    assert.equal(
      isStudioLogoFile(found('File:Apple logo black.svg', ['Apple Inc. logos']), 'Apple'),
      true
    );
  });

  it('refuses a product of the studio filed under its logos (a real search result)', () => {
    /* Searching Commons for "Valve" returned this first: Valve's headset. */
    assert.equal(
      isStudioLogoFile(found('File:Valve Index logo.svg', ['Valve Corporation logos']), 'Valve'),
      false
    );
    assert.equal(
      isStudioLogoFile(found('File:Nintendo Switch logo.svg', ['Nintendo logos']), 'Nintendo'),
      false
    );
  });

  it('refuses a product’s logo, a similarly named thing and a partial word', () => {
    /* Found by "depicts: Valve" — the Steam logo is Valve's product, not Valve. */
    assert.equal(
      isStudioLogoFile(found('File:Steam Logo.png', ['Valve Corporation logos']), 'Valve'),
      false
    );
    assert.equal(
      isStudioLogoFile(
        found('File:Swagelok valve logo.png', ['Valves', 'Swagelok logos']),
        'Valve'
      ),
      false
    );
    assert.equal(isStudioLogoFile(found('File:Valves logo.png', ['Valves logos']), 'Valve'), false);
    assert.equal(
      isStudioLogoFile(found('File:Valve photo.jpg', ['Valve Corporation logos']), 'Valve'),
      false
    );
  });

  it('compares names once punctuation and case are gone', () => {
    assert.equal(namesMatch('Valve', 'VALVe'), true);
    assert.equal(namesMatch('Supergiant Games', 'supergiant  games'), true);
    assert.equal(namesMatch('Valve', 'Valve Corporation'), false);
    assert.equal(namesMatch('', ''), false);
  });
});

describe('currentLogosFirst', () => {
  it('moves a studio’s retired mark behind its current one, keeping search order otherwise', () => {
    const titles = ['File:Valve old logo.svg', 'File:Valve logo.svg', 'File:Valve logo white.svg'];
    const ranked = currentLogosFirst(titles.map((title) => file({ title })));
    assert.deepEqual(
      ranked.map((entry) => entry.title),
      ['File:Valve logo.svg', 'File:Valve logo white.svg', 'File:Valve old logo.svg']
    );
  });
});
