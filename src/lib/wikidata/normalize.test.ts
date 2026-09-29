import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bestStatementsOf,
  entityIdOf,
  quantityOf,
  statementsOf,
  yearOf,
  type WikidataClaims,
} from './claims.ts';
import {
  creditCandidateIds,
  formatBudgetAmount,
  formatMagnitude,
  hasGameInfo,
  normalizeGameInfo,
  referencedEntityIds,
} from './normalize.ts';
import type { WikidataEntityRef } from './types.ts';

/* Snaks and statements in the exact shape `wbgetentities` returns them. */

const item = (id: string) => ({
  snaktype: 'value',
  property: 'P0',
  datavalue: {
    type: 'wikibase-entityid',
    value: { 'entity-type': 'item', 'numeric-id': Number(id.slice(1)), id },
  },
});
const text = (value: string) => ({ snaktype: 'value', datavalue: { type: 'string', value } });
const time = (year: number, precision = 9) => ({
  snaktype: 'value',
  datavalue: {
    type: 'time',
    value: { time: `+${year}-00-00T00:00:00Z`, timezone: 0, precision, calendarmodel: 'x' },
  },
});
const quantity = (amount: string, unit = '1') => ({
  snaktype: 'value',
  datavalue: { type: 'quantity', value: { amount, unit } },
});
const unknownValue = { snaktype: 'somevalue', property: 'P725' };

type Qualifiers = Record<string, unknown[]>;
const statement = (mainsnak: unknown, qualifiers: Qualifiers = {}, rank = 'normal') => ({
  mainsnak,
  qualifiers,
  rank,
  type: 'statement',
});

const entity = (unit: string) => `http://www.wikidata.org/entity/${unit}`;

/** A label map as `resolveWikidataLabels` returns it: `[label]` or `[label, canonical id]`. */
function refsOf(labels: Record<string, string | null | [string | null, string]>) {
  const refs = new Map<string, WikidataEntityRef>();
  let page = 1;
  for (const [id, value] of Object.entries(labels)) {
    const [label, canonical] = Array.isArray(value) ? value : [value, id];
    refs.set(id, { id: canonical, label, pageId: page++ });
  }
  return refs;
}

const NOBODY = new Set<string>();

describe('claim readers', () => {
  it('reads an item id, and the older numeric-only form', () => {
    assert.equal(entityIdOf(item('Q42')), 'Q42');
    assert.equal(
      entityIdOf({
        snaktype: 'value',
        datavalue: { value: { 'entity-type': 'item', 'numeric-id': 7 } },
      }),
      'Q7'
    );
  });

  it('refuses somevalue, novalue and malformed snaks without throwing', () => {
    assert.equal(entityIdOf(unknownValue), null);
    assert.equal(entityIdOf({ snaktype: 'novalue' }), null);
    assert.equal(entityIdOf({ snaktype: 'value' }), null);
    assert.equal(entityIdOf({ snaktype: 'value', datavalue: { value: 'Q42' } }), null);
    assert.equal(entityIdOf({ snaktype: 'value', datavalue: { value: { id: 'P31' } } }), null);
    assert.equal(entityIdOf(null), null);
    assert.equal(entityIdOf('Q42'), null);
  });

  it('parses signed quantities and their unit', () => {
    assert.deepEqual(quantityOf(quantity('+306000000', entity('Q123213'))), {
      amount: 306000000,
      unit: 'Q123213',
    });
    assert.deepEqual(quantityOf(quantity('-1.5')), { amount: -1.5, unit: null });
    assert.deepEqual(quantityOf(quantity('+40', 'not a unit')), { amount: 40, unit: null });
    assert.equal(quantityOf(quantity('1e5')), null);
    assert.equal(quantityOf(quantity('')), null);
    assert.equal(quantityOf(text('+40')), null);
  });

  it('reads a year only when the year itself is known', () => {
    assert.equal(yearOf(time(2015)), 2015);
    assert.equal(yearOf(time(2014, 11)), 2014);
    assert.equal(yearOf(time(2010, 8)), null);
    assert.equal(
      yearOf({
        snaktype: 'value',
        datavalue: { value: { time: '-0500-00-00T00:00:00Z', precision: 9 } },
      }),
      null
    );
  });

  it('drops deprecated statements and anything that is not a statement', () => {
    const claims: WikidataClaims = {
      P166: [statement(item('Q1')), statement(item('Q2'), {}, 'deprecated'), 'junk', null],
      P1411: 'not a list',
    };
    assert.deepEqual(
      statementsOf(claims, 'P166').map((s) => entityIdOf(s.mainsnak)),
      ['Q1']
    );
    assert.deepEqual(statementsOf(claims, 'P1411'), []);
    assert.deepEqual(statementsOf(claims, 'P999'), []);
  });

  it('takes the preferred statements when there are any, and all of them otherwise', () => {
    const claims = {
      P2130: [statement(quantity('+1')), statement(quantity('+2'), {}, 'preferred')],
      P86: [statement(item('Q1')), statement(item('Q2'))],
    };
    assert.deepEqual(
      bestStatementsOf(claims, 'P2130').map((s) => quantityOf(s.mainsnak)?.amount),
      [2]
    );
    assert.equal(bestStatementsOf(claims, 'P86').length, 2);
  });
});

describe('cast', () => {
  it('pairs each actor with the character on their own statement (Far Cry 3)', () => {
    const claims = {
      P161: [
        statement(item('Q5558319'), { P453: [item('Q30642231')] }),
        statement(item('Q6832484'), { P453: [item('Q35525972')] }),
        statement(item('Q1296804')),
      ],
    };
    const refs = refsOf({
      Q5558319: 'Michael Mando',
      Q30642231: 'Vaas Montenegro',
      Q6832484: 'Gianpaolo Venuta',
      Q35525972: 'Jason Brody',
      Q1296804: 'Boyd Banks',
    });

    const { cast } = normalizeGameInfo('Q796529', claims, refs, NOBODY);
    assert.deepEqual(
      cast.map((member) => [member.name, member.characters]),
      [
        ['Michael Mando', ['Vaas Montenegro']],
        ['Gianpaolo Venuta', ['Jason Brody']],
        /* Kept without a character rather than dropped or given one. */
        ['Boyd Banks', []],
      ]
    );
  });

  it('falls back to P4633 when there is no P453 label (Cyberpunk 2077)', () => {
    const claims = {
      P725: [
        statement(item('Q138188'), { P4633: [text('Female V')] }),
        statement(item('Q43416'), { P453: [item('Q131100908')], P4633: [text('Johnny')] }),
        /* A P453 item with no label left to show: the string is used instead. */
        statement(item('Q17581437'), { P453: [item('Q999')], P4633: [text('River Ward')] }),
      ],
    };
    const refs = refsOf({
      Q138188: 'Cherami Leigh',
      Q43416: 'Keanu Reeves',
      Q131100908: 'Johnny Silverhand',
      Q17581437: 'Jason Hightower',
      Q999: null,
    });

    const { cast } = normalizeGameInfo('Q3182559', claims, refs, NOBODY);
    assert.deepEqual(
      cast.map((member) => [member.name, member.characters]),
      [
        ['Cherami Leigh', ['Female V']],
        ['Keanu Reeves', ['Johnny Silverhand']],
        ['Jason Hightower', ['River Ward']],
      ]
    );
  });

  it('merges one performer credited under P161 and P725, and marks voice-only credits', () => {
    const claims = {
      P161: [statement(item('Q1'), { P453: [item('Q10')] })],
      P725: [
        statement(item('Q1'), { P453: [item('Q10')] }),
        statement(item('Q1'), { P453: [item('Q11')] }),
        statement(item('Q2'), { P453: [item('Q12')] }),
      ],
    };
    const refs = refsOf({
      Q1: 'Troy Baker',
      Q2: 'Nolan North',
      Q10: 'Joel',
      Q11: 'Sam',
      Q12: 'Nathan',
    });

    const { cast } = normalizeGameInfo('Q100', claims, refs, NOBODY);
    assert.deepEqual(cast, [
      {
        id: 'Q1',
        name: 'Troy Baker',
        characters: ['Joel', 'Sam'],
        cast: true,
        voice: true,
        dub: null,
      },
      {
        id: 'Q2',
        name: 'Nolan North',
        characters: ['Nathan'],
        cast: false,
        voice: true,
        dub: null,
      },
    ]);
  });

  it('keeps a dub as its own row, after the original cast (Overwatch)', () => {
    const claims = {
      P725: [
        statement(item('Q1'), { P453: [item('Q10')], P407: [item('Q5146')] }),
        statement(item('Q2'), { P453: [item('Q10')], P407: [item('Q1860'), item('Q9142')] }),
        statement(item('Q3'), { P453: [item('Q11')] }),
      ],
    };
    const refs = refsOf({
      Q1: 'Portuguese Actor',
      Q2: 'English Actor',
      Q3: 'Another Actor',
      Q10: 'Tracer',
      Q11: 'Mercy',
      Q5146: 'Portuguese',
      Q1860: 'English',
      Q9142: 'Irish',
    });

    const { cast } = normalizeGameInfo('Q18515944', claims, refs, NOBODY);
    assert.deepEqual(
      cast.map((member) => [member.name, member.dub]),
      [
        ['English Actor', null],
        ['Another Actor', null],
        ['Portuguese Actor', 'Portuguese'],
      ]
    );
  });

  it('skips a performer who is unknown or has no label, never printing an id', () => {
    const claims = {
      P725: [
        statement(unknownValue, { P453: [item('Q10')] }),
        statement(item('Q2'), { P453: [item('Q10')] }),
      ],
    };
    const { cast } = normalizeGameInfo(
      'Q189784',
      claims,
      refsOf({ Q2: null, Q10: 'Doomguy' }),
      NOBODY
    );
    assert.deepEqual(cast, []);
  });
});

describe('awards and nominations', () => {
  it('lists awards oldest first, once each, with their year', () => {
    const claims = {
      P166: [
        statement(item('Q2'), { P585: [time(2015)] }),
        statement(item('Q1'), { P585: [time(2014, 11)] }),
        statement(item('Q2'), { P585: [time(2015)] }),
        statement(item('Q3')),
        statement(item('Q2'), { P585: [time(2016)] }),
      ],
    };
    const refs = refsOf({
      Q1: 'Most Anticipated Game',
      Q2: 'Game of the Year',
      Q3: 'Best Environment',
    });

    const { awards } = normalizeGameInfo('Q4267401', claims, refs, NOBODY);
    assert.deepEqual(awards, [
      { id: 'Q1', name: 'Most Anticipated Game', year: 2014 },
      { id: 'Q2', name: 'Game of the Year', year: 2015 },
      { id: 'Q2', name: 'Game of the Year', year: 2016 },
      { id: 'Q3', name: 'Best Environment', year: null },
    ]);
  });

  it('drops an undated copy of an award that is also recorded with a year', () => {
    const claims = { P166: [statement(item('Q1')), statement(item('Q1'), { P585: [time(2020)] })] };
    const { awards } = normalizeGameInfo('Q100', claims, refsOf({ Q1: 'Best Score' }), NOBODY);
    assert.deepEqual(awards, [{ id: 'Q1', name: 'Best Score', year: 2020 }]);
  });

  it('keeps nominations apart from awards and infers neither from the other', () => {
    const claims = {
      P166: [statement(item('Q1'))],
      P1411: [statement(item('Q1')), statement(item('Q2'))],
    };
    const info = normalizeGameInfo(
      'Q100',
      claims,
      refsOf({ Q1: 'GOTY', Q2: 'Best Narrative' }),
      NOBODY
    );
    assert.deepEqual(
      info.awards.map((award) => award.name),
      ['GOTY']
    );
    assert.deepEqual(
      info.nominations.map((award) => award.name),
      ['GOTY', 'Best Narrative']
    );
  });
});

describe('budget', () => {
  it('formats a known currency and says what the figure covers (Cyberpunk 2077)', () => {
    const claims = {
      P2130: [
        statement(quantity('+660000000', entity('Q123213')), { P518: [item('Q739302')] }),
        statement(quantity('+540000000', entity('Q123213')), { P518: [item('Q39809')] }),
      ],
    };
    const refs = refsOf({ Q123213: 'złoty', Q739302: 'economic production', Q39809: 'marketing' });

    const { budgets } = normalizeGameInfo('Q3182559', claims, refs, NOBODY);
    assert.deepEqual(budgets, [
      {
        amount: 660000000,
        currency: 'PLN',
        formatted: 'PLN 660 million',
        scope: 'Economic production',
        year: null,
      },
      {
        amount: 540000000,
        currency: 'PLN',
        formatted: 'PLN 540 million',
        scope: 'Marketing',
        year: null,
      },
    ]);
  });

  it('prints a symbol for dollars and joins several parts', () => {
    const claims = {
      P2130: [
        statement(quantity('+40000000', entity('Q4917')), { P518: [item('Q1'), item('Q2')] }),
      ],
    };
    const refs = refsOf({ Q4917: 'United States dollar', Q1: 'development', Q2: 'marketing' });
    const [budget] = normalizeGameInfo('Q214232', claims, refs, NOBODY).budgets;
    assert.equal(budget.formatted, '$40 million');
    assert.equal(budget.scope, 'Development and marketing');
  });

  it('uses the preferred figure over the ones it revised', () => {
    const claims = {
      P2130: [
        statement(quantity('+100', entity('Q4917'))),
        statement(quantity('+265000000', entity('Q4917')), { P585: [time(2013)] }, 'preferred'),
      ],
    };
    const { budgets } = normalizeGameInfo('Q17452', claims, refsOf({ Q4917: 'dollar' }), NOBODY);
    assert.deepEqual(
      budgets.map((budget) => [budget.formatted, budget.year]),
      [['$265 million', 2013]]
    );
  });

  it('falls back to the unit’s label, then to the bare number, and never converts', () => {
    assert.equal(formatBudgetAmount(20_000_000, null, 'Deutsche Mark'), '20 million Deutsche Mark');
    assert.equal(formatBudgetAmount(1_500_000, null, null), '1.5 million');
    assert.equal(formatBudgetAmount(-5_000_000, { code: 'USD', symbol: '$' }, null), '−$5 million');

    const claims = { P2130: [statement(quantity('+306000000', entity('Q424242')))] };
    const [unlabelled] = normalizeGameInfo('Q1', claims, refsOf({}), NOBODY).budgets;
    assert.equal(unlabelled.formatted, '306 million');
    assert.equal(unlabelled.currency, null);
  });

  it('scales figures the way a reader says them', () => {
    assert.equal(formatMagnitude(306_000_000), '306 million');
    assert.equal(formatMagnitude(2_500_000_000), '2.5 billion');
    assert.equal(formatMagnitude(999_999_999), '1 billion');
    assert.equal(formatMagnitude(850_000), '850,000');
    assert.equal(formatMagnitude(12_345.678), '12,345.68');
    assert.equal(formatMagnitude(0), '0');
  });

  it('skips a malformed quantity instead of printing it', () => {
    const claims = { P2130: [statement(quantity('lots')), statement(text('$50 million'))] };
    assert.deepEqual(normalizeGameInfo('Q1', claims, refsOf({}), NOBODY).budgets, []);
  });
});

describe('credits and people', () => {
  /* Death Stranding: one man in four roles, a composer, and a studio. */
  const claims = {
    P57: [statement(item('Q315577'))],
    P58: [statement(item('Q315577'))],
    P162: [statement(item('Q315577')), statement(item('Q20979355'))],
    P287: [statement(item('Q315577'))],
    P86: [statement(item('Q59780390'))],
  };
  const refs = refsOf({
    Q315577: 'Hideo Kojima',
    Q59780390: 'Ludvig Forssell',
    Q20979355: 'Kojima Productions',
  });
  const humans = new Set(['Q315577', 'Q59780390']);

  it('lists each person once with every role, most senior first', () => {
    const { people } = normalizeGameInfo('Q24666782', claims, refs, humans);
    assert.deepEqual(people, [
      {
        id: 'Q315577',
        name: 'Hideo Kojima',
        roles: ['Director', 'Producer', 'Designer', 'Screenwriter'],
      },
      { id: 'Q59780390', name: 'Ludvig Forssell', roles: ['Composer'] },
    ]);
  });

  it('prefers people over a studio in the same role, and keeps the role sections', () => {
    const info = normalizeGameInfo('Q24666782', claims, refs, humans);
    assert.deepEqual(
      info.producers.map((credit) => credit.name),
      ['Hideo Kojima']
    );
    assert.deepEqual(
      info.designers.map((credit) => credit.name),
      ['Hideo Kojima']
    );
    assert.deepEqual(
      info.screenwriters.map((credit) => credit.name),
      ['Hideo Kojima']
    );
    assert.deepEqual(
      info.composers.map((credit) => credit.name),
      ['Ludvig Forssell']
    );
  });

  it('keeps a studio where it is the only credit, but never lists it as a person (The Witcher 3)', () => {
    const info = normalizeGameInfo(
      'Q4267401',
      { P162: [statement(item('Q1172164'))], P86: [statement(item('Q19005369'))] },
      refsOf({ Q1172164: 'CD Projekt RED', Q19005369: 'Marcin Przybyłowicz' }),
      new Set(['Q19005369'])
    );
    assert.deepEqual(
      info.producers.map((credit) => credit.name),
      ['CD Projekt RED']
    );
    assert.deepEqual(
      info.people.map((person) => person.name),
      ['Marcin Przybyłowicz']
    );
  });

  it('keeps two people who share a name, and merges one person referenced under a merged id', () => {
    const info = normalizeGameInfo(
      'Q1',
      {
        P86: [statement(item('Q1')), statement(item('Q2')), statement(item('Q3'))],
      },
      refsOf({ Q1: 'John Smith', Q2: 'John Smith', Q3: ['John Smith', 'Q1'] }),
      new Set(['Q1', 'Q2'])
    );
    assert.deepEqual(
      info.people.map((person) => person.id),
      ['Q1', 'Q2']
    );
    assert.equal(info.composers.length, 2);
  });
});

describe('what is requested, and what counts as nothing', () => {
  it('asks for the labels the screen can show and nothing it cannot', () => {
    const claims = {
      P166: [statement(item('Q1'))],
      P725: [statement(item('Q2'), { P453: [item('Q3')], P407: [item('Q4')], P585: [time(2020)] })],
      P2130: [statement(quantity('+5', entity('Q4917')), { P518: [item('Q5')] })],
      P57: [statement(item('Q6'))],
      /* Genre and platform: on every game, and none of this screen's business. */
      P136: [statement(item('Q7'))],
      P400: [statement(item('Q8'))],
    };
    assert.deepEqual(referencedEntityIds(claims), ['Q1', 'Q2', 'Q3', 'Q4', 'Q4917', 'Q5', 'Q6']);
    assert.deepEqual(creditCandidateIds(claims), ['Q6']);
  });

  it('treats no item, and an item with none of these facts, as nothing to show', () => {
    assert.equal(hasGameInfo(null), false);
    assert.equal(hasGameInfo(undefined), false);

    const empty = normalizeGameInfo(
      'Q28677081',
      { P136: [statement(item('Q7'))] },
      refsOf({ Q7: 'racing' }),
      NOBODY
    );
    assert.equal(hasGameInfo(empty), false);

    const one = normalizeGameInfo(
      'Q1',
      { P86: [statement(item('Q2'))] },
      refsOf({ Q2: 'Composer' }),
      NOBODY
    );
    assert.equal(hasGameInfo(one), true);
  });
});
