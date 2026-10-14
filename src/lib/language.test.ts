import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  APP_LANGUAGE,
  LANGUAGES,
  automaticLanguages,
  canRead,
  coerceReadingChoice,
  detectLanguage,
  isKnownLanguage,
  languageList,
  languageName,
  languageSummary,
  languagesOfLocales,
  readingLanguages,
  reviewLanguage,
} from './language.ts';

/**
 * Reviews as people write them: a sentence or two about a game. Two a
 * language, one of them short, because a short review is the usual one.
 */
const REVIEWS: Record<string, string[]> = {
  en: [
    'One of the best games I have ever played. The story is great and the combat never gets old.',
    'Great game, but the ending was a letdown.',
    'This game is shit, but it is a golden one. A smooth, big, curved, dark shit.',
    'One of the best brawl stars updates',
  ],
  es: [
    'Uno de los mejores juegos que he jugado nunca. La historia es increíble y el combate no se hace pesado.',
    'Muy buen juego, pero el final me decepcionó.',
    'Una obra maestra, sin más. Vale la pena cada hora.',
  ],
  pt: [
    'Um dos melhores jogos que já joguei. A história é incrível e o combate nunca fica cansativo.',
    'Jogo muito bom, mas o final não me agradou.',
    'Não é para todos, mas eu adorei cada minuto.',
  ],
  fr: [
    "Un des meilleurs jeux auxquels j'ai joué. L'histoire est incroyable et les combats ne lassent jamais.",
    'Très bon jeu, mais la fin est décevante.',
    "C'est un chef-d'œuvre, tout simplement.",
  ],
  de: [
    'Eines der besten Spiele, die ich je gespielt habe. Die Geschichte ist großartig und die Kämpfe werden nie langweilig.',
    'Sehr gutes Spiel, aber das Ende war enttäuschend.',
    'Das ist einfach nicht mein Spiel.',
  ],
  it: [
    'Uno dei migliori giochi a cui abbia mai giocato. La storia è incredibile e il combattimento non stanca mai.',
    'Gioco molto bello, ma il finale non mi è piaciuto.',
    'Un capolavoro, niente da aggiungere.',
  ],
  nl: [
    'Een van de beste spellen die ik ooit heb gespeeld. Het verhaal is geweldig en de gevechten vervelen nooit.',
    'Heel goed spel, maar het einde viel tegen.',
  ],
  pl: [
    'Jedna z najlepszych gier, w jakie grałem. Fabuła jest świetna, a walka się nie nudzi.',
    'Bardzo dobra gra, ale zakończenie mnie zawiodło.',
  ],
  tr: [
    'Oynadığım en iyi oyunlardan biri. Hikayesi harika ve dövüşler hiç sıkmıyor.',
    'Çok güzel bir oyun ama sonu beni hayal kırıklığına uğrattı.',
  ],
  sv: [
    'Ett av de bästa spelen jag någonsin har spelat. Berättelsen är fantastisk och striderna blir aldrig tråkiga.',
    'Mycket bra spel, men slutet var inte så bra.',
  ],
  da: [
    'Et af de bedste spil jeg nogensinde har spillet. Historien er fantastisk, og kampene bliver aldrig kedelige.',
    'Et rigtig godt spil, men slutningen var lidt skuffende.',
  ],
  nb: [
    'Et av de beste spillene jeg noen gang har spilt. Historien er fantastisk, og kampene blir aldri kjedelige.',
    'Veldig bra spill, men slutten var litt skuffende.',
  ],
  id: [
    'Salah satu game terbaik yang pernah saya mainkan. Ceritanya sangat bagus dan pertarungannya tidak membosankan.',
    'Game ini bagus banget, tapi akhir ceritanya mengecewakan.',
  ],
  ru: [
    'Одна из лучших игр, в которые я играл. Сюжет отличный, а бои не надоедают.',
    'Очень хорошая игра, но концовка меня разочаровала.',
  ],
  uk: [
    'Одна з найкращих ігор, у які я грав. Сюжет чудовий, а бої не набридають.',
    'Дуже гарна гра, але кінцівка мене розчарувала.',
  ],
  bg: [
    'Една от най-добрите игри, които съм играл. Сюжетът е страхотен, а битките не омръзват.',
    'Много добра игра, но краят беше разочароващ.',
  ],
  fi: [
    'Yksi parhaista peleistä, joita olen koskaan pelannut. Tarina on upea ja taistelu ei käy tylsäksi.',
    'Todella hyvä peli, mutta loppu oli pettymys.',
  ],
  et: [
    'Üks parimaid mänge, mida olen kunagi mänginud. Lugu on suurepärane ja võitlus ei muutu igavaks.',
    'Väga hea mäng, aga lõpp oli pettumus.',
  ],
  cs: [
    'Jedna z nejlepších her, jaké jsem kdy hrál. Příběh je skvělý a souboje nikdy neomrzí.',
    'Velmi dobrá hra, ale konec mě zklamal.',
  ],
  sk: [
    'Jedna z najlepších hier, aké som kedy hral. Príbeh je skvelý a súboje nikdy neomrzia.',
    'Veľmi dobrá hra, ale koniec ma sklamal.',
  ],
  ro: [
    'Unul dintre cele mai bune jocuri pe care le-am jucat vreodată. Povestea este grozavă.',
    'Un joc foarte bun, dar finalul m-a dezamăgit.',
  ],
  hu: [
    'Az egyik legjobb játék, amivel valaha játszottam. A történet nagyszerű.',
    'Nagyon jó játék, de a vége csalódás volt.',
  ],
  vi: [
    'Một trong những trò chơi hay nhất mà tôi từng chơi. Cốt truyện rất tuyệt vời.',
    'Trò chơi rất hay nhưng kết thúc hơi thất vọng.',
  ],
  ca: [
    'Un dels millors jocs als quals he jugat mai. La història és increïble i el combat no cansa.',
    'Molt bon joc, però el final em va decebre.',
  ],
  gl: [
    'Un dos mellores xogos aos que xoguei nunca. A historia é incrible e o combate non cansa.',
    'Moi bo xogo, pero o final non me gustou.',
  ],
  hr: [
    'Jedna od najboljih igara koje sam ikad igrao. Priča je odlična, a borba nikad ne dosadi.',
    'Vrlo dobra igra, ali kraj me razočarao.',
  ],
  sr: [
    'Једна од најбољих игара које сам икад играо. Прича је одлична, а борба никад не досади.',
    'Веома добра игра, али крај ме је разочарао.',
  ],
  sl: [
    'Ena najboljših iger, kar sem jih kdaj igral. Zgodba je odlična in boj ni nikoli dolgočasen.',
    'Zelo dobra igra, vendar me je konec razočaral.',
  ],
  az: [
    'Oynadığım ən yaxşı oyunlardan biridir. Hekayəsi əladır və döyüşlər heç vaxt darıxdırmır.',
    'Çox gözəl oyundur, amma sonu məni məyus etdi.',
  ],
  af: [
    'Een van die beste speletjies wat ek nog ooit gespeel het. Die storie is baie goed.',
    'Baie goeie speletjie, maar die einde was nie lekker nie.',
  ],
  ja: [
    '今まで遊んだ中で最高のゲームのひとつ。ストーリーが素晴らしい。',
    '神ゲー',
    'めっちゃ面白い',
  ],
  zh: ['这是我玩过的最好的游戏之一，剧情非常精彩。', '画面很好但是剧情一般'],
  ko: ['지금까지 해본 게임 중 최고입니다. 스토리가 훌륭해요.', '갓겜'],
  ar: ['واحدة من أفضل الألعاب التي لعبتها. القصة رائعة والقتال ممتع.'],
  fa: ['یکی از بهترین بازی‌هایی که تا به حال انجام داده‌ام. داستان فوق‌العاده است و گیم‌پلی عالی.'],
  he: ['אחד המשחקים הטובים ביותר ששיחקתי. הסיפור מדהים.'],
  el: ['Ένα από τα καλύτερα παιχνίδια που έχω παίξει. Η ιστορία είναι εξαιρετική.'],
  th: ['หนึ่งในเกมที่ดีที่สุดที่เคยเล่นมา เนื้อเรื่องยอดเยี่ยมมาก'],
  hi: ['यह मेरे द्वारा खेले गए सबसे अच्छे खेलों में से एक है। कहानी शानदार है।'],
};

test('every language the detector names is one it can find', () => {
  for (const [language, reviews] of Object.entries(REVIEWS)) {
    for (const review of reviews) {
      assert.equal(detectLanguage(review), language, `${language}: ${review}`);
    }
  }
  /* And the reverse: a language in the picker with no sentence here is a
     language nobody checked. */
  for (const { code } of LANGUAGES) {
    assert.ok(REVIEWS[code]?.length, `no review written in ${code} to test with`);
  }
});

test('what has no language is given none', () => {
  /* The live database's own test reviews, and the verdicts people actually
     leave. Each of these labelled wrongly would be hidden from somebody. */
  const nothing = [
    'Period',
    'NN',
    'Vaas',
    'Ghj',
    '10/10',
    'GOTY',
    '',
    '   ',
    '👍👍👍',
    'Hades',
    'Elden Ring',
    'ok',
    'meh',
    'https://example.com/a-very-long-link-with-the-and-of-in-it',
    '@somebody #the #and #of',
  ];
  for (const text of nothing) {
    assert.equal(detectLanguage(text), null, JSON.stringify(text));
  }
  assert.equal(detectLanguage(null), null);
  assert.equal(detectLanguage(undefined), null);
});

test('two kanji are not Chinese, and are not guessed at', () => {
  /* 最高 is the commonest two-character review in Japanese, and it is Han
     only. Labelled `zh` it would be hidden from every Japanese reader. */
  assert.equal(detectLanguage('最高'), null);
  assert.equal(detectLanguage('神作'), null);
  assert.equal(detectLanguage('最高のゲーム'), 'ja');
});

test('a language it does not know is not mistaken for one it does', () => {
  /* Lithuanian, Latvian, Swahili, Tagalog, Icelandic, Basque, Welsh: none is
     in the list, so the honest answer is null — never the nearest neighbour.
     A wrong label hides; a missing one does not.

     Estonian was in this list and came back Finnish: the two share "on",
     "ja", "ei" and "olen". The cure for a neighbour that is mistaken for a
     language is to name the neighbour, which is why Estonian, Slovenian,
     Galician, Afrikaans and Azerbaijani are in the detector. */
  const unknown = [
    'Vienas geriausių žaidimų, kokius esu žaidęs. Istorija puiki, o kovos niekada nenusibosta.',
    'Viena no labākajām spēlēm, ko esmu spēlējis. Stāsts ir lielisks.',
    'Mojawapo ya michezo bora ambayo nimewahi kucheza. Hadithi ni nzuri sana.',
    'Isa sa pinakamagandang laro na nalaro ko. Napakaganda ng kwento.',
    'Einn besti leikur sem ég hef spilað. Sagan er frábær.',
    'Inoiz jokatu dudan jokorik onenetako bat. Istorioa bikaina da.',
    "Un o'r gemau gorau i mi eu chwarae erioed. Mae'r stori'n wych.",
  ];
  for (const text of unknown) {
    assert.equal(detectLanguage(text), null, text);
  }
});

test('a script is not a language when more than one is written in it', () => {
  /* Urdu is written in Arabic letters and is neither Arabic nor Persian. */
  assert.equal(
    detectLanguage('یہ میرے کھیلے گئے بہترین کھیلوں میں سے ایک ہے۔ کہانی شاندار ہے۔'),
    null
  );
  /* Belarusian and Kazakh are Cyrillic and are not Russian. */
  assert.equal(detectLanguage('Гэта адна з найлепшых гульняў, у якія я калі-небудзь гуляў.'), null);
  assert.equal(detectLanguage('Бұл мен ойнаған ең жақсы ойындардың бірі. Оқиғасы керемет.'), null);
  /* Chinese that quotes a Japanese title is still Chinese. */
  assert.equal(
    detectLanguage(
      '《塞尔达传说》（日语：ゼルダの伝説）是任天堂推出的动作冒险游戏系列，非常好玩。'
    ),
    'zh'
  );
  /* And Korean that glosses itself in English is still Korean. */
  assert.equal(detectLanguage('비디오 게임(video game)은 정말 재미있는 취미입니다.'), 'ko');
});

test('a name or a quotation from another language does not change the answer', () => {
  assert.equal(
    detectLanguage('The best thing about Ghost of Tsushima is that 侍 actually feels right.'),
    'en'
  );
  assert.equal(
    detectLanguage('El combate de Hollow Knight: Silksong es de lo mejor que he jugado este año.'),
    'es'
  );
  /* Formatting marks from `<RichText>` are not words. */
  assert.equal(detectLanguage('**Muy** buen juego, *pero* el final no me gustó.'), 'es');
});

test('the game’s own name is not evidence', () => {
  const title = 'The Last of Us';
  /* Four English words, and all of them the game's. */
  assert.equal(detectLanguage(title), 'en');
  assert.equal(detectLanguage(title, { ignore: [title] }), null);
  assert.equal(detectLanguage('the last of us', { ignore: [title] }), null);
  assert.equal(
    detectLanguage('The Last of Us es de lo mejor que he jugado nunca.', { ignore: [title] }),
    'es'
  );
  /* Out as a phrase, never out of the middle of a word: a review of *Rain*
     still says "training", and one of *Control* still says "uncontrollable". */
  assert.equal(
    detectLanguage('The training is the best part of the whole game.', { ignore: ['Rain'] }),
    'en'
  );
  assert.equal(detectLanguage('Rain', { ignore: ['Rain'] }), null);
  /* A name too short to be anything but a coincidence is not removed. */
  assert.equal(detectLanguage('It is the best of them.', { ignore: ['It'] }), 'en');
  assert.equal(reviewLanguage('The Last of Us', null, { ignore: [title] }), null);
  assert.equal(reviewLanguage('Obra maestra.', 'El mejor juego de la generación'), 'es');
});

test('what is stored beside a review', () => {
  assert.equal(reviewLanguage('Muy buen juego, pero el final me decepcionó.'), 'es');
  assert.equal(reviewLanguage('Vaas'), null);
  assert.equal(reviewLanguage(''), null);
  assert.equal(reviewLanguage('   '), null);
  assert.equal(reviewLanguage(null), null);
});

test('every code fits the column that holds it', () => {
  /* 0038's CHECK is the shape of a code. A language added here that the
     database would refuse is a review that cannot be saved. */
  const migration = readFileSync(
    new URL('../../supabase/migrations/0038_discovery_ranking.sql', import.meta.url),
    'utf8'
  );
  const pattern = /review_lang ~ '([^']+)'/.exec(migration);
  assert.ok(pattern, 'the migration states the shape of a code');
  const shape = new RegExp(pattern[1]);

  for (const { code } of LANGUAGES) assert.match(code, shape);
  for (const [language, reviews] of Object.entries(REVIEWS)) {
    assert.match(language, shape);
    for (const review of reviews) assert.match(reviewLanguage(review) ?? 'en', shape);
  }
  assert.equal(new Set(LANGUAGES.map((entry) => entry.code)).size, LANGUAGES.length);
});

test('a phone’s locales become the languages somebody reads', () => {
  assert.deepEqual(languagesOfLocales(['es-ES', 'en-US']), ['es', 'en']);
  assert.deepEqual(languagesOfLocales(['pt_BR']), ['pt']);
  assert.deepEqual(languagesOfLocales(['zh-Hans-CN', 'zh-Hant-TW']), ['zh']);
  /* Android still reports Hebrew and Indonesian under their retired codes. */
  assert.deepEqual(languagesOfLocales(['iw_IL', 'in_ID']), ['he', 'id']);
  assert.deepEqual(languagesOfLocales(['no', 'nn-NO', 'nb-NO']), ['nb']);
  /* Reading one is reading the other. */
  assert.deepEqual(languagesOfLocales(['ms-MY']), ['id']);
  assert.deepEqual(languagesOfLocales(['bs-BA']), ['hr']);
  assert.deepEqual(languagesOfLocales(['sr-RS']), ['sr', 'hr']);
  /* Not a tag, not a string, or a language no review is labelled with. */
  assert.deepEqual(languagesOfLocales(['', 'C', 'POSIX', 42, null, 'lt-LT', 'en']), ['en']);
});

test('automatic is the app’s language, the phone’s, and the ones they write in', () => {
  assert.equal(APP_LANGUAGE, 'en');
  assert.deepEqual(automaticLanguages(['es-ES'], []), ['en', 'es']);
  assert.deepEqual(automaticLanguages(['es-ES'], ['pt', 'es']), ['en', 'es', 'pt']);
  /* A phone in a language nothing is labelled with still reads the interface. */
  assert.deepEqual(automaticLanguages(['lt-LT'], []), ['en']);
  assert.deepEqual(automaticLanguages([], []), ['en']);
});

test('the three ways of choosing', () => {
  assert.deepEqual(readingLanguages({ mode: 'auto' }, ['fr-FR'], ['de']), ['en', 'fr', 'de']);
  assert.deepEqual(readingLanguages({ mode: 'chosen', languages: ['ja'] }, ['fr-FR'], ['de']), [
    'ja',
  ]);
  assert.equal(readingLanguages({ mode: 'all' }, ['fr-FR'], ['de']), null);
});

test('a stored choice is checked, and anything else is automatic', () => {
  assert.deepEqual(coerceReadingChoice({ mode: 'all' }), { mode: 'all' });
  assert.deepEqual(coerceReadingChoice({ mode: 'chosen', languages: ['es', 'xx', 'es', 7] }), {
    mode: 'chosen',
    languages: ['es'],
  });
  /* Choosing nothing would show nothing. It is not a choice. */
  assert.deepEqual(coerceReadingChoice({ mode: 'chosen', languages: [] }), { mode: 'auto' });
  for (const junk of [
    null,
    undefined,
    'all',
    3,
    [],
    { mode: 'everything' },
    { languages: ['es'] },
  ]) {
    assert.deepEqual(coerceReadingChoice(junk), { mode: 'auto' });
  }
});

test('unknown is readable; another language is not', () => {
  const reading = ['en', 'es'];
  assert.equal(canRead('es', reading), true);
  assert.equal(canRead('ja', reading), false);
  /* No label, and a row from a database that has no such column. */
  assert.equal(canRead(null, reading), true);
  assert.equal(canRead(undefined, reading), true);
  /* Every language: nothing is left out. */
  assert.equal(canRead('ja', null), true);
});

test('names, as the interface says them', () => {
  assert.equal(languageName('es'), 'Spanish');
  assert.equal(languageName('xx'), 'XX');
  assert.equal(languageList([]), '');
  assert.equal(languageList(['en']), 'English');
  assert.equal(languageList(['en', 'es']), 'English and Spanish');
  assert.equal(languageList(['en', 'es', 'fr']), 'English, Spanish and French');
  /* One line under a heading: three by name, then a count. */
  assert.equal(languageSummary(['en', 'es', 'fr']), 'English, Spanish and French');
  assert.equal(languageSummary(['en', 'es', 'fr', 'de']), 'English, Spanish and 2 more');
  assert.equal(languageSummary(['en']), 'English');
  assert.equal(isKnownLanguage('es'), true);
  assert.equal(isKnownLanguage('lt'), false);
  assert.equal(isKnownLanguage(null), false);
});
