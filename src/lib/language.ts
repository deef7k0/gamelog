/**
 * What language a review is written in, and which languages a reader reads.
 *
 * ## Why this exists
 *
 * Letterboxd — the reference for how this app discovers things — does nothing
 * about language: its interface is English, a film's popular reviews are every
 * language mixed and ranked by likes, and its one language feature is a
 * translate button for paying members. People install browser extensions to
 * hide the reviews they cannot read. That is the gap this fills, for the lists
 * that *choose* what to show somebody (a chart, a suggestion). A game's own
 * reviews are never narrowed by it unless the reader asks.
 *
 * ## The detector
 *
 * Two questions, in order:
 *
 * 1. **Which script?** Hangul is Korean and hiragana is Japanese whatever the
 *    words are, so those are answered by counting letters.
 * 2. **Which language of that script?** For Latin and Cyrillic, by the words
 *    every sentence is held together with — "the", "que", "nicht", "это" —
 *    plus the few a game review cannot avoid ("juego", "jeu", "Spiel").
 *
 * **A word counts for less the more languages have it.** "de" is Spanish,
 * Portuguese, French, Dutch and eight more, and is worth a twelfth to each;
 * "juego" is Spanish alone and is worth one. That is what tells Danish from
 * Norwegian, whose sentences share most of their words and differ in a few
 * ("af" / "av", "meget" / "veldig"): counted equally, the two tied on nine
 * sentences in ten.
 *
 * **It answers `null` far more readily than it guesses.** "Vaas", "10/10" and
 * "GOTY" have no language, and a review labelled wrongly is hidden from the
 * people who could read it, where one left unlabelled is shown to everybody.
 * So a winner needs evidence (`MIN_EVIDENCE`), a share of the words
 * (`MIN_COVERAGE`) and a lead over the runner-up (`MIN_LEAD`).
 *
 * Measured on prose nobody here wrote — sentences from Wikipedia. On a set it
 * had never been run on (1,545 sentences, in thirty-four of its languages):
 * 86.8% right, 12.9% unknown, 0.3% wrong. CLAUDE.md § Discovery has all three
 * sets, the languages it is weak in, and what each set changed.
 *
 * No `\p{…}` anywhere: a property escape the engine does not know is a syntax
 * error while the module loads, on a phone, and code point ranges cost nothing.
 *
 * Pure — `npm test` runs it, against sentences in every language it names.
 */

/** The interface's language. Whoever is using the app reads it. */
export const APP_LANGUAGE = 'en';

// ---------------------------------------------------------------------------
// Scripts
// ---------------------------------------------------------------------------

type Script =
  | 'latin'
  | 'cyrillic'
  | 'greek'
  | 'arabic'
  | 'hebrew'
  | 'devanagari'
  | 'thai'
  | 'hangul'
  | 'hiragana'
  | 'katakana'
  | 'han';

/** Inclusive code point ranges. Letters only — digits and marks are not text. */
const RANGES: readonly (readonly [number, number, Script])[] = [
  [0x0041, 0x005a, 'latin'],
  [0x0061, 0x007a, 'latin'],
  [0x00c0, 0x00d6, 'latin'],
  [0x00d8, 0x00f6, 'latin'],
  [0x00f8, 0x024f, 'latin'],
  /* ə — Azerbaijani's commonest vowel, filed under phonetics. */
  [0x0259, 0x0259, 'latin'],
  [0x1e00, 0x1eff, 'latin'],
  [0x0370, 0x03ff, 'greek'],
  [0x0400, 0x052f, 'cyrillic'],
  [0x05d0, 0x05ea, 'hebrew'],
  [0x0620, 0x064a, 'arabic'],
  [0x066e, 0x06d3, 'arabic'],
  [0x0750, 0x077f, 'arabic'],
  [0x0904, 0x0939, 'devanagari'],
  [0x0958, 0x0961, 'devanagari'],
  [0x0e01, 0x0e2e, 'thai'],
  [0x0e30, 0x0e3a, 'thai'],
  [0x0e40, 0x0e45, 'thai'],
  [0x1100, 0x11ff, 'hangul'],
  [0x3130, 0x318f, 'hangul'],
  [0xac00, 0xd7af, 'hangul'],
  [0x3041, 0x3096, 'hiragana'],
  [0x30a1, 0x30fa, 'katakana'],
  /* ー, the long vowel: ゲー is two characters of katakana, not one. */
  [0x30fc, 0x30fe, 'katakana'],
  [0x3400, 0x4dbf, 'han'],
  [0x4e00, 0x9fff, 'han'],
];

function scriptOf(code: number): Script | null {
  for (const [from, to, script] of RANGES) {
    if (code >= from && code <= to) return script;
  }
  return null;
}

/**
 * How much one letter says, against a Latin one. A Han character is a word and
 * a Hangul block a syllable, so a Korean sentence that quotes "(video game)"
 * is still more Korean than English though it has fewer letters.
 */
const LETTER_WEIGHT: Partial<Record<Script, number>> = {
  han: 3,
  hiragana: 2,
  katakana: 2,
  hangul: 3,
};

/** Scripts whose words are separated by spaces, so they can be counted. */
const WORDED: ReadonlySet<Script> = new Set(['latin', 'cyrillic']);

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * Each language's commonest words: what its sentences are built from, then a
 * few a game review cannot avoid.
 *
 * **The lists are not kept apart, they are kept honest.** A word two languages
 * have is in both, and `wordIndex` works out what it is worth from how many
 * hold it. Leaving "de" out of Dutch because Spanish has it would make Dutch
 * harder to find and Spanish no easier.
 *
 * Elisions are split at the apostrophe before they get here, so French is
 * given "c", "j", "l" and "qu" (c'est, j'ai, l'histoire, qu'il) and English
 * "s", "t" and "ll".
 *
 * Left out on purpose: loanwords every gaming community uses ("gameplay",
 * "boss", "remake", "cool"), which say only that the review is about a game.
 */
const WORDS: Readonly<Record<string, string>> = {
  en: `the and is it of to in that this was for with but not you have are be on as at by an so if
    its they there what which would about just very really one all has had more than when from
    my me we i he she his her them their our your been were do does did can could will should
    because while after before into out up no yes too also still even only much many most some
    any every these those then here how why who or am over again through between both each few
    other such own same now made make makes get got way well back think thing things something
    nothing everything anything never always lot little bit time hours first last new old world
    characters music ending beautiful awesome perfect terrible enjoyed enjoy recommend finished
    favorite favourite absolutely definitely probably actually honestly though although however
    since until where being having may might must us him off down under once game games great
    good best fun love loved story played playing play masterpiece amazing bad boring worth ever
    better like pretty feels feel nice solid decent s t m d ll ve don doesn didn isn wasn aren
    developed released published player players known called series bought buy plays lets come
    came went take took give gave find found use used using often among later whole large small`,
  es: `el la los las de del que y en un una es no se por con para lo como más pero sus le ya este
    esta esto estos estas muy también hay me mi sin sobre todo todos toda cuando tiene fue son
    está están era porque aunque mejor peor juego juegos historia bueno buena buen malo mala
    jugar jugabilidad increíble gran obra maestra vale pena nunca siempre nada algo cada mucho
    poco tan al ni yo eso hasta desde donde quien si sí he ha han puede hace tengo creo nos te
    tu su uno dos e o u entre así después antes bien solo sólo demasiado aún todavía ese esa ser
    estar sido soy somos tienen hacer hecho pueden gusta gustó encanta encantó años año vez
    veces tiempo mundo personajes música final combate gráficos bastante además mientras durante
    otro otra otros mismo misma aquí ahí ahora luego entonces cual cuales qué cómo les ti mí él
    ella ellos nosotros usted tus mis nuestro primera primer primero serie videojuego
    videojuegos desarrollado lanzado jugador jugadores fueron través parte según contra hacia
    tras casi tanto tal menos mayor nuevo nueva único debe había sería podría tener ver dar
    decir mal muchos muchas algunos varias varios juegazo recomiendo electrónico electrónica
    utiliza utilizan llamado llamada conocido conocida empresa compañía creado creada ejemplo
    embargo cuyo cuya dicho dicha cualquier ambos ellas ustedes permite permiten suele trata
    estaba estaban tenía tenían hizo dijo dio gusto gustado encantado segundo`,
  pt: `o os as de do da dos das que e em um uma é não se por com para como mais mas seu sua ao já
    este esta isso isto muito também há me meu minha sem sobre tudo todos toda quando tem foi
    são está estão era porque embora melhor pior jogo jogos história bom boa ruim jogar
    jogabilidade incrível grande obra prima vale pena nunca sempre nada algo cada pouco tão nem
    eu você até desde onde quem pra pelo pela no na nos nas num numa ele ela só ainda bem ou
    entre assim depois antes demais esse essa te tu nós pode faz tenho acho ser ter vai têm
    estar sido sou somos fazer feito podem gosto gostei adorei amei anos ano vez vezes tempo
    mundo personagens música final combate gráficos bastante além enquanto durante outro outra
    outros mesmo mesma aqui aí agora então qual quais lhe mim eles elas vocês meus seus nosso
    primeira primeiro série videogame jogador jogadores foram através parte segundo contra após
    quase tanto tal menos maior novo nova único deve havia seria poderia ver dar dizer mal
    muitos muitas alguns várias vários pelos pelas aos às à dele dela aquele uns umas sob lá sim
    talvez apenas desenvolvido lançado eletrônico recomendo eletrónico utiliza utilizam chamado
    chamada conhecido conhecida empresa criado criada exemplo entanto cujo cuja qualquer ambos
    nossa suas permite permitem trata estava estavam tinha tinham fez disse deu gostado todo`,
  gl: `o os as de do da dos das que e en un unha uns unhas é non se por con para como máis mais
    pero seu súa ao xa este esta isto moi tamén hai me meu miña sen sobre todo todos toda cando
    ten foi son está están era porque aínda mellor peor xogo xogos historia bo boa malo xogar
    incrible gran obra mestra vale pena nunca sempre nada algo cada pouco tan nin eu ti el ela
    nós ata desde onde quen no na nos nas nun nunha só ben ou entre así despois antes demasiado
    ese esa pode fai teño creo ser ter vai videoxogo videoxogos xogador xogadores primeira
    primeiro ano anos serie desenvolvido lanzado dous dúas segundo contra case menos novo nova
    moitos moitas algúns varios polo pola polos polas dun dunha co coa cos coas lle lles che`,
  fr: `le la les de des du que et en un une est pas ne se par avec pour ce cette ces comme plus
    mais son sa ses au aux déjà très aussi il elle ils elles on nous vous je me mon ma mes sans
    sur tout tous toute quand été sont était parce bien meilleur pire jeu jeux histoire bon
    bonne mauvais jouer incroyable grand chef œuvre oeuvre jamais toujours rien chaque peu si ni
    moi ça jusqu depuis où qui dans ai qu ou entre ainsi après avant trop encore donc y être
    avoir fait peut dont leur leurs cela vraiment tellement ont étaient sera serait peuvent
    faire faut aime adore adoré ans année fois temps monde personnages musique fin combat
    graphismes assez pendant autre autres même ici là maintenant alors quel quelle quoi lui eux
    notre nos votre vos premier première série vidéo joueur joueurs travers partie selon contre
    vers presque tant tel moins nouveau nouvelle seul doit devrait avait avaient pourrait voir
    dire mal beaucoup plusieurs quelques certains chez sous puis car cependant toutefois lorsque
    lors afin dès développé sorti cet ceux celle celui suis sommes étais as avons avez c j l d n
    s m t électronique utilise utilisent appelé appelée connu connue société entreprise créé
    créée exemple quelconque permet permettent agit firent dit donné aimé parmi souvent`,
  de: `der die das und ist nicht ein eine einen einem einer es ich du er sie wir ihr zu mit auf für
    von den dem des im in an auch aber oder als wie so nur noch schon sehr war sind hat habe
    haben wird kann man mehr wenn dass bei nach aus über um bis durch was wer wo mir mich dir
    sich kein keine spiel spiele geschichte gut schlecht beste besser spielen gespielt einfach
    wirklich immer nie alles etwas jeder viel wenig ganz mal hier dann doch weil vor zum zur
    diese dieser dieses mein meine sein seine wurde werden macht gibt bin bist seid waren wäre
    würde können konnte muss müssen soll sollte will mag gab machen gemacht jahre jahr zeit welt
    charaktere musik ende kampf grafik ziemlich außerdem während andere anderen selbst dort
    jetzt welche welcher ihm ihn ihnen uns euch unser erste ersten serie videospiel videospiele
    spieler wurden worden teil laut gegen fast weniger neue neuen einzige hatte hatten könnte
    sehen sagen viele vielen einige mehrere unter zwischen ob denn also jedoch sowie sondern
    damit ohne seit beim vom ins am entwickelt veröffentlicht diesem diesen dessen deren ihre
    ihrer ihren seiner seinen leider trotzdem schön toll spaß liebe empfehlen elektronisches
    elektronische verwendet genannt bekannt unternehmen firma erstellt beispiel erlaubt handelt
    machte sagte mochte oft später ganze große kleine`,
  it: `il lo la i gli le di del della dei delle che e in un una uno è non si per con come più ma
    suo sua al alla già questo questa molto anche mi mio mia senza su tutto tutti tutta quando
    ha ho stato sono era perché bene migliore peggiore gioco giochi storia buono bello bella
    brutto giocare incredibile grande capolavoro mai sempre niente qualcosa ogni poco così né io
    tu lui lei noi fino da dal dalla dove chi nel nella ed ad se ci ne o tra fra dopo prima
    troppo ancora quindi essere avere fatto può cui loro davvero proprio hanno abbiamo erano
    sarà sarebbe possono fare fa piace piaciuto adoro anni anno volta volte tempo mondo
    personaggi musica finale combattimento grafica abbastanza inoltre mentre durante altro altra
    altri stesso stessa qui lì ora adesso poi allora quale quali cosa nostro vostro primo serie
    videogioco videogiochi giocatore giocatori furono attraverso parte secondo contro verso
    quasi tanto tale meno nuovo nuova unico deve dovrebbe aveva avevano potrebbe vedere dire
    male molti molte alcuni diversi sotto però infatti invece oppure cioè sviluppato pubblicato
    degli dagli negli sugli agli nei sui dai ai col sul sulla dello allo nello questi queste
    quello quella quelli siamo sei ero hai c l d dell all nell sull quest consiglio elettronico
    elettronica utilizza utilizzano chiamato chiamata conosciuto conosciuta azienda società
    creato creata esempio tuttavia qualsiasi entrambi permette permettono tratta fece disse
    diede spesso`,
  nl: `de het een en van is niet dat die in op te met voor zijn was er maar om ook als aan bij nog
    naar dan wat uit zo over door kan heeft hebben ik je jij hij zij we wij ze mijn me mij dit
    deze geen wel meer heel erg veel al of tot omdat toch spel spellen verhaal goed slecht beste
    beter spelen gespeeld echt altijd nooit alles iets elke weinig gewoon leuk mooi wordt worden
    werd waren kunnen moet moeten zou hun haar ons onze na tijdens zonder ben bent zouden kon
    wil mag gaat maken maakt gemaakt jaar keer tijd wereld personages muziek einde gevecht nogal
    bovendien terwijl andere zelf hier daar nu toen welke hem hen eerste serie computerspel
    computerspellen videospel speler spelers werden via deel volgens tegen bijna minder nieuwe
    enige had hadden zien zeggen vele enkele verschillende onder tussen want dus echter evenals
    zodat sinds ontwikkeld uitgebracht hebt heb uw jullie u niets iemand niemand waar wanneer
    hoe waarom wie daarom zeer prachtig geweldig aanrader elektronisch gebruikt gebruiken
    genoemd bekend bedrijf voorbeeld staat deed zei gaf vaak later hele grote kleine twee drie
    zich toe net min wees sedert amper word reeks ander gaan jou gebruik lekker eigen`,
  af: `die en van is in het n wat vir om te met dit word se sy hy ek ons julle hulle daar ook maar
    of as aan by op uit tot was kan sal moet nog al baie goed nie na deur oor onder tussen
    sonder tydens omdat dat wanneer waar hoe hoekom wie hierdie daardie een twee eerste jaar tyd
    wêreld speletjie speletjies spel speel gespeel speler spelers rekenaarspeletjie
    rekenaarspeletjies rekenaar storie verhaal goeie slegte beste beter regtig altyd nooit alles
    iets elke min mooi lekker ontwikkel vrygestel reeks verskillende ander self hier nou toe dan
    net slegs meer minder nuwe gehad wees sou kon wil mag gaan maak gemaak my jou hom haar hul
    dié wel dus egter sowel sedert volgens teen amper gebaseer gebruik bekend`,
  pl: `i w z na do nie to że się jest o jak ale po co tak za od przez dla czy tylko już jeszcze
    bardzo był była było są ma mam może być ten ta te tego tej tym ich go mu mi mnie ja ty on
    ona my wy oni który która które kiedy gdzie bo lub albo więc też bez nad pod przy gra gry
    grę historia fabuła dobra dobry świetna świetny zła najlepsza lepsza grać naprawdę zawsze
    nigdy wszystko coś każdy mało dużo jednak oraz sobie tu tam ze we jestem jesteś byli będzie
    mogą można robić lubię podoba lat rok roku raz czas świat postacie muzyka koniec walka
    grafika dość ponadto podczas inny inna inne sam sama tutaj teraz potem wtedy jaki jaka jakie
    nas was nasz pierwszy pierwsza seria serii komputerowa komputerowe komputerowych gracz
    gracza graczy zostały została został część według przeciw prawie mniej nowy nowa jedyny miał
    miała widzieć wiele wielu kilka niektóre między ponieważ aby żeby gdy jeśli choć czyli przed
    poza wśród także również wydana wydany której którego których którym jej jego tych tę tą nic
    ktoś nikt jako ku u świetnie polecam warto zostało musi muszą gracze gier grze grach wideo
    firma firmę stworzona latach główny główna przede wszystkim ani niż następnie więcej nowe
    nową dobre zły często zwykle przykład powodu wokół jednej jednym pierwszej takich taki taka
    takie wszystkie wszystkich każda każde innych własne swoje swoją swój nim nią nimi nich
    tobie`,
  tr: `ve bir bu da de için çok ama ile gibi daha en ne o var yok ben sen biz siz onlar mi mı mu mü
    değil olarak kadar sonra önce her şey ki ya hem ise veya bile sadece artık hiç oyun oyunu
    oyunlar hikaye hikayesi güzel iyi kötü harika oynadım oynamak gerçekten bence bana benim
    olan oldu olmuş diye çünkü şu böyle öyle zaman tek tam kesinlikle göre olduğu olduğunu etmek
    eder yapmak yapılan yılında yıl kez dünya karakter karakterler müzik son savaş grafik
    oldukça ayrıca sırasında diğer kendi burada şimdi hangi ona onu onun bize bizim ilk seri
    serisi oyuncu oyuncular oyuncunun tarafından karşı neredeyse az yeni vardı olabilir görmek
    birçok bazı çeşitli altında arasında ancak fakat böylece beri geliştirilen yayınlanan
    geliştirilmiş olup üzerinde içinde bunun bunu buna şekilde türü türünde adlı oyunun oyunları
    oyunlarının edilen edilir olur oluyor mükemmel tavsiye ederim sevdim bayıldım aynı tüm bütün
    eski büyük küçük birlikte itibaren üzere üzerine hakkında nedeniyle rağmen doğru dışında
    yanında biri hiçbir herhangi kendisi onların bunlar nasıl neden niçin nerede kim kaç evet
    hayır vardır yoktur olmuştur olmaktadır edilmiştir edilmektedir yapılmıştır bulunmaktadır
    sahiptir denir adı oyununun oyunda oyunlarda oyuncuların oyuncuya bilgisayar konsol
    geliştirildi yayımlandı yayınlandı çıktı satıldı kullanılan kullanılır video idi`,
  az: `məni məndə sənə səni etdi edib olar olmaz vaxt indiki oyundur və bir bu da də üçün çox amma ilə kimi daha ən nə o var yox mən sən biz siz onlar deyil
    olaraq qədər sonra əvvəl hər şey ki ya həm isə yaxud hətta yalnız artıq heç oyun oyunu
    oyunlar hekayə gözəl yaxşı pis əla oynamaq həqiqətən məncə mənə mənim olan oldu olub çünki
    belə elə zaman tək tam görə olduğu etmək edir ildə il dəfə dünya personaj musiqi son döyüş
    qrafika olduqca həmçinin zamanı digər öz burada indi hansı ona onu onun bizə bizim ilk
    seriya video oyunçu oyunçular tərəfindən qarşı az yeni idi ola bilər görmək bəzi müxtəlif
    altında arasında lakin ancaq beləliklə bəri hazırlanmış buraxılmış üzərində içində bunun
    bunu buna şəkildə adlı oyunun oyunları edilən edilir olur kompüter onların bunlar kim bütün
    eyni böyük kiçik birlikdə`,
  sv: `och att det är en ett i på som för med av inte den har jag du han hon vi de till om men var
    så från kan när eller också mycket bara än nu här där vad alla min mitt sig mig dig man ska
    skulle blir blev varit spel spelet berättelse bra dålig bästa bättre spela spelat verkligen
    alltid aldrig allt något varje lite väldigt riktigt kul rolig efter eftersom kunna kunde
    måste vill får gör göra gjort år gång tid värld karaktärer musik slut strid grafik ganska
    dessutom medan under andra annan själv sedan vilken vilka honom henne oss vår första serie
    datorspel datorspelet spelare spelaren genom del enligt mot nästan mindre ny nya enda hade
    se säga många några flera olika mellan dock samt utvecklat utvecklades släpptes vilket detta
    dessa denna dess sin sitt sina deras hans hennes ut upp in över utan vid hos åt även ingen
    inget någon hur varför vem fantastiskt rekommenderar älskar vara används använda kallas
    finns både antingen samma året sålt sålda spelen ofta bland först känd kallad senare fick
    gick kom kommer tar tagit ger gav hitta hela helt stora stor små liten goda själva flesta
    vissa då före emellertid därför alltså`,
  da: `og at det er en et i på som for med af ikke den har jeg du han hun vi de til om men var så
    fra kan når eller også meget kun bare end nu her der hvad alle min mit sig mig dig man skal
    skulle bliver blev været spil spillet historie god godt dårlig bedste bedre spille virkelig
    altid aldrig alt noget hver lidt sjov fordi efter nogle hvor rigtig mere mest nogen hvordan
    hvorfor hvem blevet uden mellem ud op ind mod ved hos over under første år gang tid verden
    figurer musik slutning kamp grafik ret desuden mens andre anden selv siden hvilken ham hende
    os vores serie computerspil spiller spillere spilleren gennem del ifølge næsten mindre ny
    nye eneste havde se sige mange flere forskellige dog samt udviklet udgivet hvilket dette
    disse denne dens sin sit sine deres hans hendes ingen intet vil må fantastisk anbefaler
    elsker synes sjovt kedeligt igen sådan være bruges bruge brugt kaldes kaldet findes både
    enten samme året solgt solgte spillene ofte blandt først kendt senere hvert gør gøre får fik
    gik kom kommer tager taget giver gav finde hele helt store stor små lille gode selve fleste
    enkelte hvis da før imidlertid derfor altså sker typisk derudover række`,
  nb: `og at det er en et i på som for med av ikke den har jeg du han hun vi de til om men var så
    fra kan når eller også veldig mye kun bare enn nå her der hva alle min mitt seg meg deg man
    skal skulle blir ble vært spill spillet historie god bra dårlig beste bedre spille spilt
    virkelig alltid aldri alt noe hver litt gøy morsom fordi etter noen hvor mer mest hvordan
    hvorfor hvem blitt uten mellom ut opp inn mot ved hos over under første år gang tid verden
    figurer musikk slutt kamp grafikk ganske dessuten mens andre annen selv siden hvilken ham
    henne oss vår våre serie dataspill spiller spillere spilleren gjennom del ifølge nesten
    mindre ny nye eneste hadde se si mange flere forskjellige dog samt utviklet utgitt hvilket
    dette disse denne dens sin sitt sine deres hans hennes ingen ingenting vil må fantastisk
    anbefaler elsker synes kjedelig igjen slik å ei være brukes bruke brukt kalles kalt finnes
    både enten samme året solgt solgte spillene spillkonsoller datamaskin datamaskiner ofte
    blant først kjent senere hvert gjør gjøre får fikk gikk kom kommer tar tatt gir ga finne
    hele helt store stor små liten gode selve ulike fleste enkelte hvis dersom da før imidlertid
    derfor altså skjer rekke`,
  id: `yang dan di ini itu dengan untuk tidak dari ke pada adalah saya aku kamu sangat bagus
    permainan cerita tapi tetapi karena juga sudah akan bisa ada lebih banget seru atau jadi
    kalau buat sama banyak hanya masih belum lagi mereka kita kami dia nya oleh dalam seperti
    terbaik jelek bermain main game tersebut merupakan sebagai telah dapat serta antara menjadi
    memiliki digunakan pemain pertama tahun kali waktu dunia karakter musik akhir grafis cukup
    selain saat ketika lain lainnya sendiri sini sekarang kemudian mana apa siapa kenapa
    bagaimana seri melalui bagian menurut terhadap hampir kurang baru satu dua tiga punya
    melihat beberapa berbagai bawah namun sehingga sejak dikembangkan dirilis hal para secara
    bahwa jika maka pun gak nggak bukan jangan harus ingin mau suka keren mantap menarik sekali
    elektronik menggunakan disebut dikenal perusahaan dibuat contoh memungkinkan sering seluruh
    besar kecil`,
  cs: `je se na že to s z v ve do o k i a ale jako za by po pro při jsou byl byla bylo byly jsem
    jsi jsme být má mají může který která které tento tato toto ten ta tak také též nebo už jen
    ještě velmi když kde co kdo jak proč protože pokud však tedy mezi před pod nad bez od až si
    jeho její jejich můj moje náš on ona oni my vy já ty není hra hry hru her hráč hráče hráči
    příběh skvělá skvělý dobrá dobrý špatná nejlepší lepší hrát opravdu vždy nikdy všechno něco
    každý málo hodně videohra videohry počítačová první roce rok let série vydána vyvinuta lze
    jedna jeden jedno dva podle proti téměř méně nový nová více mnoho několik některé různé
    doporučuji ho mu jim jí kterém kterých tyto těchto tom té tím tu mohou musí hráčů hře herní
    videoher společnost vydaná vyvíjená vytvořená letech hlavní především kdy aby ani či než
    zatímco potom nyní teď zde nové novou dobré špatný konec mě mi tě`,
  sk: `je sa na že to s z v vo do o k i a ale ako za by po pre pri sú bol bola bolo boli som si sme
    byť má majú môže ktorý ktorá ktoré tento táto toto ten tá tak tiež alebo už len ešte veľmi
    keď kde čo kto prečo pretože ak však teda medzi pred pod nad bez od až jeho jej ich môj moja
    náš on ona oni my vy ja ty nie hra hry hru hier hráč hráča hráči príbeh skvelá skvelý dobrá
    dobrý zlá najlepšia lepšia hrať naozaj vždy nikdy všetko niečo každý málo veľa videohra
    počítačová prvý roku rok rokov séria vydaná vyvinutá jedna jeden dva podľa proti takmer
    menej nový nová viac mnoho niekoľko niektoré rôzne odporúčam aj so zo ju ho mu im ktorom
    ktorej ktorých tieto týchto tom tej tým tú môžu musí musia hráčov hre herná herné videohier
    spoločnosť spoločnosťou vyvíjaná vytvorená rokoch prvá prvé hlavný hlavná hlavne
    predovšetkým kedy aby ani či kým než zatiaľ potom teraz tu tam nové novú dobré zlý koniec ma
    mi mňa ťa`,
  ro: `și în de la cu pe un o este sunt al ale care că nu se din pentru mai dar sau ca fi fost era
    au are am ai ești e îl îi le lui ei lor său sa meu mea acest această aceste acești cel cea
    cei cele foarte când unde ce cine cum deoarece dacă însă deci între înainte sub peste fără
    după până prin despre către eu tu el ea noi voi ele joc jocul jocuri jocurile jocului
    poveste povestea bun bună rău juca jucat jucător jucători chiar mereu niciodată tot toate
    toți ceva fiecare puțin mult multe video primul prima an anul ani serie seria lansat
    dezvoltat unul una doi două conform aproape nou nouă câteva unele diferite recomand grozav
    minunat electronic folosește numit cunoscut companie creat exemplu totuși permite adesea
    întreg mare mic`,
  fi: `ja on ei se että oli ovat olen olet ole ollut olla voi myös mutta tai kuin kun jos niin vain
    jo vielä hyvin tämä tuo ne nämä joka jotka jossa jonka mikä mitä kuka missä miten miksi
    koska sekä eli kanssa ilman ennen jälkeen välillä alla päällä minä sinä hän me te he minun
    sinun hänen sen niiden peli pelin peliä pelit pelejä pelien pelaaja pelaajan pelaajat tarina
    hyvä huono paras parempi pelata pelannut todella aina koskaan kaikki jotain jokainen vähän
    paljon videopeli ensimmäinen vuonna vuosi sarja julkaistu kehittänyt yksi kaksi mukaan lähes
    uusi useita monia eri suosittelen loistava mahtava erittäin sitä siitä siinä sille tässä
    tätä niitä kuten noin yli jopa ehkä nyt sitten täällä siellä kuitenkin esimerkiksi yleensä
    usein joskus nykyään aikana kautta avulla lisäksi vuoden vuosina peleihin peleissä pelissä
    pelistä pelaajien pelaajia julkaistiin julkaisi kehitti saanut sai tuli tehty tehdä pitää
    voidaan voivat olivat olisi kuuluu kolme monet muut muita muun toinen ensimmäisen viimeinen
    suuri pieni uuden vanha maailman maailmassa sarjan sarjassa osa osan tämän näiden näin siis
    vaan vaikka kunnes`,
  et: `ja on ei see et oli kui ka ning või aga mis kes kus siis veel juba väga nii ta ma sa me te
    nad mu tema selle seda sellest selles oma kõik iga üks kaks kolm mäng mängu mänge mängud
    mängija mängijad lugu hea halb parim parem mängida tõesti alati mitte kunagi midagi palju
    vähe esimene aasta aastal sari välja antud arendatud järgi peaaegu uus mitu erinevad
    soovitan suurepärane olen oled oleme olid olla saab võib peab tuleb kuid sest kuna kuigi ehk
    nagu vaid ainult samuti koos ilma enne pärast vahel all peal juures kohta eest poolt läbi
    üle alla sisse videomäng arvutimäng mida mille millel neid need nende seal siin nüüd praegu
    lihtsalt päris igav lõpp`,
  hu: `a az és is hogy nem egy ez azt meg de már még csak van volt lesz vagy mint ha mert ami aki
    amely amelyek ezt ebben annak ennek nagyon itt ott most akkor amikor ahol hol mi ki hogyan
    miért pedig tehát között előtt után alatt felett nélkül én te ő ti ők játék játékot játékok
    játékos játékosok történet jó rossz legjobb jobb játszani játszottam tényleg mindig soha
    minden valami mindenki kevés sok videojáték videójáték első évben év sorozat megjelent
    fejlesztette kettő szerint majdnem új több néhány különböző ajánlom remek fantasztikus lehet
    kell volna lenne vannak voltak által számára valamint illetve azonban így úgy olyan ilyen
    egyik másik el fel be le át elektronikus használ nevezett ismert cég készült például
    lehetővé gyakran később egész nagy kis`,
  vi: `và là của có không một những các được trong cho với này đó để người khi đã sẽ đang rất cũng
    nhưng hoặc hay như nếu vì nên thì mà ở từ đến về trên dưới giữa trước sau tôi bạn anh chị nó
    chúng ta họ mình trò chơi cốt truyện tốt tệ nhất hơn thật luôn bao giờ mọi thứ gì mỗi ít
    nhiều điện tử đầu tiên năm loạt phát hành triển hai theo gần mới vài khác nhau tuyệt vời đồ
    họa âm nhạc nhân vật còn lại ra vào lên xuống qua nào sao ai đâu đây kia ấy thế vậy rồi chỉ
    cả đều phải cần muốn thích yêu biết làm thấy nói`,
  ca: `el la els les de del dels que i en un una uns unes és no es per amb com més però seu seva al
    als ja aquest aquesta això molt també hi ha em meu meva sense sobre tot tots tota quan té va
    van són està era perquè encara millor pitjor joc jocs història bo bona dolent jugar
    increïble gran obra mestra val pena mai sempre res alguna cada poc tan ni jo tu ell ella
    nosaltres fins des on qui si sí he han pot fa tinc crec ens et o entre així després abans bé
    només massa aquell aquella videojoc videojocs jugador jugadors primer primera any anys sèrie
    desenvolupat llançat dos dues segons contra gairebé menys nou nova molts moltes alguns
    diversos l d s n m electrònic utilitza anomenat conegut empresa creat exemple tanmateix
    permet sovint`,
  hr: `je i u na se da su za s sa od do o a ali kao što koji koja koje to ovo taj ta te tako
    također ili već samo još vrlo jako kada gdje tko kako zašto jer ako međutim dakle između
    prije poslije nakon pod nad bez ja ti on ona mi vi oni moj moja njegov njezin njihov nije
    bio bila bilo bili biti ima imaju može mogu igra igre igru igara igrač igrača igrači priča
    odlična odličan dobra dobar loša najbolja bolja igrati stvarno uvijek nikad sve nešto svaki
    malo puno videoigra videoigre prva prvi godine godina serija objavljena razvijena jedan
    jedna dva prema protiv gotovo manje novi nova više mnogo nekoliko neke različite
    preporučujem iz po pri kroz ove ovaj ova tog toga tom bi će ću ćemo sam si smo ste li ne ni
    pa nego no koju kojoj kojem kojima ovog ovom tim toj tu mora moraju igri igrama videoigara
    tvrtka razvio razvila stvorena godinama glavni prvenstveno kad niti dok zatim sada ovdje
    tamo nove novu dobre loš postaju neki nekih mnogih najčešće često obično primjer primjerice
    zbog tijekom oko preko unutar jedne jednom prve kojih`,
  sl: `je in v na se da so za z s od do o a ali kot ki kar to ta tako tudi že samo še zelo ko kje
    kdo kako zakaj ker če vendar torej med pred po pod nad brez jaz ti on ona mi vi oni moj
    njegov njen njihov ni bil bila bilo bili biti ima imajo lahko igra igre igro iger igralec
    igralca igralci zgodba odlična dobra slaba najboljša boljša igrati res vedno nikoli vse
    nekaj vsak malo veliko videoigra videoigre prva prvi leta leto serija izdana razvita en ena
    dva glede proti skoraj manj novi nova več mnogo nekatere različne priporočam iz pri skozi
    tega tem bi bo bodo sem si smo ste ne pa ter oziroma kjer katere kateri katerih jih ga mu ji
    ob zaradi tej teh računalniška elektronska`,
  ru: `и в не на я что он с как а то все она так его но да ты к у же вы за бы по только ее мне было
    вот от меня еще нет о из ему теперь когда даже ну если уже или ни быть был него до вас
    нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы
    тебя их чем была сам чтоб без будто чего раз тоже себе под будет это этот эта очень игра
    игру игры сюжет хорошая отличная лучшая просто который которая всё ещё были также которые
    после году между более время первый игр игрок игроки игрока является стал стала чтобы со во
    об над при её этой этого этом эти тем том них всех один одна одной первая серии серия года
    лет компьютерная компьютерных разработана выпущена которой которых однако например обычно
    часто иногда поэтому потому хотя пока затем сейчас здесь больше меньше новая новые плохая
    игроков игрой играх видеоигра видеоигры видеоигр компания создана главный всего могут должен
    должны`,
  uk: `і в не на я що він з як а то все вона так його але та ти до у ж ви за би по тільки її мені
    було ось від мене ще немає про із йому тепер коли навіть ну якщо вже або ні бути був там
    потім себе нічого їй може вони тут де є треба для ми тебе їх ніж була сам без чого також
    собі під буде це цей ця дуже гра гру ігри сюжет гарна чудова найкраща просто який яка й чи
    були які після році між більш час перший ігор гравець гравці гравця щоб зі над при цієї
    цього цьому ці тим тому них всіх один одна однієї перша серії серія року років комп
    розроблена випущена має можна яку якій якому яких однак наприклад зазвичай часто іноді хоча
    поки зараз більше менше нова нові гарний поганий гравців грою іграх відеогра відеоігри
    відеоігор компанія створена головний всього можуть повинен повинні`,
  bg: `и в не на аз че той с как а то всички тя така но да ти към у же вие за би по само ми беше
    ето от мен още няма из сега когато дори ако вече или ни съм е са бил там после себе нищо
    може те тук където има трябва ние тях била сам без също под ще това този тази много игра
    играта игри игрите сюжет добра страхотна просто който която със при като били които след
    година между повече време първи първата играч играчът играчи във над през върху един една
    едно тези му си се най видео видеоигра компютърна серия серията разработена издадена
    видеоигрите видеоигри играчите версия версии години годината век част често използвани
    използва излиза излизат създадена създаден първоначално късно неговата нейната техните около
    чрез всеки всяка всичко някои други друг нов нова нови голям голяма малък добър лош могат
    имат бъде бъдат бе сме сте ли обаче затова защото докато преди срещу според почти кога къде
    какво кой коя кое защо`,
  sr: `и у на се да су за с са од до о а али као што који која које то ово тај тако такође или већ
    само још веома када где ко како зашто јер ако међутим између пре после након под над без ја
    ти он она ми ви они мој његов њихов није био била било били бити има имају може могу игра
    игре игру игара играч играча играчи прича одлична добра лоша најбоља боља играти стварно
    увек никад све нешто сваки мало пуно видео прва први године година серија један једна два
    према против готово мање нови нова више много неколико из по при кроз би ће сам смо сте ли
    не ни па те него коју којој којем којима овог овом тим тој ту мора морају игри играма
    видеоигра компанија развио развила главни кад нити док затим сада овде тамо нове нову добре
    лош неки неких многих најчешће често обично пример због током око преко унутар једне једном
    прве којих`,
};

/**
 * Letters only some of these languages have. Half a word's worth, shared out
 * among them — a tiebreak between languages the words already point at.
 */
const LETTERS: readonly (readonly [string, readonly string[]])[] = [
  ['¿¡', ['es']],
  ['ñ', ['es', 'gl']],
  ['ã', ['pt', 'vi']],
  ['õ', ['pt', 'et', 'vi']],
  ['ąę', ['pl']],
  ['ć', ['pl', 'hr']],
  ['ğı', ['tr', 'az']],
  ['œ', ['fr']],
  ['å', ['sv', 'da', 'nb']],
  ['øæ', ['da', 'nb']],
  ['ä', ['de', 'sv', 'fi', 'et', 'sk']],
  ['ö', ['de', 'sv', 'tr', 'az', 'fi', 'et', 'hu']],
  ['ü', ['de', 'tr', 'az', 'et', 'hu']],
  ['èù', ['fr', 'it', 'ca']],
  ['êî', ['fr', 'pt', 'ro']],
  ['ìò', ['it', 'ca']],
  ['ô', ['sk', 'fr', 'pt', 'vi']],
  ['ăâ', ['ro', 'vi']],
  ['đ', ['hr', 'vi']],
  ['čšž', ['hr', 'sl', 'cs', 'sk']],
  /* Bulgarian writes a vowel with it; Russian uses it a few times a page. */
  ['ъ', ['bg']],
  ['і', ['uk']],
];

/**
 * Letters **one** of these languages has and no other does. A word spelled
 * with one is a word of that language whether or not the list has it:
 * "префектуры" is Russian for its ы, and no list of function words was ever
 * going to hold it. This is what finds the inflected languages, whose
 * sentences are mostly words a list cannot enumerate.
 *
 * Only for a language a listed word already points at — an accent does not
 * bring a language in — and only letters nothing *unnamed* shares either:
 * Polish's ą and ę are Lithuanian's too, so they are in `LETTERS`, not here.
 */
const OWN_LETTERS: readonly (readonly [string, string])[] = [
  ['ß', 'de'],
  ['łśźż', 'pl'],
  ['ə', 'az'],
  ['řěů', 'cs'],
  ['ľĺŕ', 'sk'],
  ['șț', 'ro'],
  ['őű', 'hu'],
  ['ơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ', 'vi'],
  ['ыэё', 'ru'],
  ['їєґ', 'uk'],
  ['јљњћђџ', 'sr'],
];

/** The most a language can be credited for its letters alone. */
const LETTER_CAP = 1.5;

/**
 * How much a winner must have been found in: two words, where a word of one
 * or two letters is half of one. "ya" and "ni" are Spanish and are also
 * Swahili, Malay and Japanese written in Latin letters; two of those in a
 * sentence are a coincidence, and "juego" is not.
 */
const MIN_EVIDENCE = 2;

/**
 * The share of a text's words the winner must account for.
 *
 * Measured, not chosen: of a thousand sentences the detector got right, twenty
 * had less than this recognised; of the ones it got wrong in a language it
 * does not name, all but one did.
 */
const MIN_COVERAGE = 0.15;

/**
 * How many more words the winner must have that the runner-up does not, than
 * the runner-up has that the winner does not.
 *
 * Two languages that share their grammar are told apart by the words they do
 * not share and by nothing else — everything they share is in both totals. So
 * the comparison is between those two piles, counted in words: Norwegian's
 * "av" against Danish's "af" is one word, whatever Swedish also thinks of it.
 */
const MIN_LEAD = 1;

/** …and the runner-up's pile may be at most this much of the winner's. */
const RIVAL_SHARE = 0.5;

/** Words read before stopping. A review's language is settled long before this. */
const WORD_BUDGET = 300;

/** Han with no kana is Chinese only once it is long enough not to be 最高. */
const MIN_HAN = 5;

/**
 * Characters Chinese writes and Japanese does not: the simplified forms of its
 * commonest words, and the particles neither script of Japanese uses. One of
 * these in a text with hardly any hiragana is Chinese quoting a Japanese
 * title, not Japanese.
 */
const CHINESE_ONLY =
  /[这们说对时为个过还没让给从发开关问门见觉认识应该话语读买卖钱车马鸟鱼龙风飞电脑网戏剧场乐欢爱很吗呢吧你她哪什么怎您谁們這說對時為個過還沒讓給從嗎]/;

/** How much of a CJK text may be hiragana before a Chinese-only character stops deciding. */
const HIRAGANA_QUOTED = 0.1;

/**
 * Cyrillic letters of languages this does not name — Belarusian, Macedonian,
 * Kazakh, Mongolian. A text with one is not Russian, whatever its words say.
 */
const OTHER_CYRILLIC = /[ўѓќѕәғқңөұүһӣӯҳҷҗҡҙҫ]/;

/**
 * And the Latin ones: Maltese, Icelandic, Lithuanian, Latvian. Consonants and
 * ė, į, ų only — a macron on a vowel is also how English spells Ōkami.
 */
const OTHER_LATIN = /[ħġċþðėįųķļņģ]/;

/** Arabic-script letters Urdu has and Arabic and Persian do not. */
const URDU = /[ٹڈڑںےہھ]/;
/** …and the ones Persian has and Arabic does not: its four, and its kaf and yeh. */
const PERSIAN = /[پچژگکی]/;

let lexicon: Map<string, string[]> | null = null;

/**
 * word → the languages that have it. Built on the first review, not at import:
 * a few thousand words that most sessions never need.
 */
function wordIndex(): Map<string, string[]> {
  if (lexicon) return lexicon;
  const index = new Map<string, string[]>();
  for (const [language, list] of Object.entries(WORDS)) {
    for (const word of new Set(list.split(/\s+/))) {
      if (!word) continue;
      const languages = index.get(word);
      if (languages) languages.push(language);
      else index.set(word, [language]);
    }
  }
  lexicon = index;
  return index;
}

/** Addresses, handles and tags are not prose, and most of them are English. */
function prose(text: string, ignore: readonly string[]): string {
  let out = text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[@#][\w-]+/g, ' ')
    .normalize('NFC')
    .toLowerCase();

  /* The game's own name is in half the reviews of it, and it is in whatever
     language the game was named in — "The Last of Us" is four English words in
     a Spanish sentence. */
  for (const phrase of ignore) {
    const needle = phrase.normalize('NFC').toLowerCase().trim();
    if (needle.length >= 3) out = withoutPhrase(out, needle);
  }
  return out;
}

const isLetter = (char: string | undefined) =>
  char !== undefined && scriptOf(char.codePointAt(0) ?? 0) !== null;

/**
 * `text` with every whole occurrence of `phrase` taken out — whole meaning not
 * in the middle of a word: a review of *Rain* still says "training".
 */
function withoutPhrase(text: string, phrase: string): string {
  let out = '';
  let from = 0;
  for (;;) {
    const at = text.indexOf(phrase, from);
    if (at === -1) return out + text.slice(from);
    const end = at + phrase.length;
    const whole = !isLetter(text[at - 1]) && !isLetter(text[end]);
    out += text.slice(from, at) + (whole ? ' ' : phrase);
    from = end;
  }
}

type Reading = {
  /** Letters per script. */
  scripts: Partial<Record<Script, number>>;
  /** Space-separated words of the worded scripts, in order, up to the budget. */
  words: string[];
};

function read(text: string): Reading {
  const scripts: Partial<Record<Script, number>> = {};
  const words: string[] = [];
  let word = '';

  const close = () => {
    if (word && words.length < WORD_BUDGET) words.push(word);
    word = '';
  };

  for (const char of text) {
    const script = scriptOf(char.codePointAt(0) ?? 0);
    if (!script) {
      close();
      continue;
    }
    scripts[script] = (scripts[script] ?? 0) + 1;
    if (WORDED.has(script)) word += char;
    else close();
  }
  close();

  return { scripts, words };
}

/** The language a worded text is in, by its words — or null when none is clear. */
function byWords(text: string, words: readonly string[]): string | null {
  if (words.length === 0) return null;

  const index = wordIndex();
  /**
   * Every piece of evidence: the languages it is for, what it is worth to each
   * when they are ranked, and what it counts as when two are compared — a word
   * is one, a letter half.
   */
  const evidence: { languages: readonly string[]; worth: number; count: number }[] = [];
  /** Words found per language — letters are not words. */
  const found = new Map<string, number>();
  /** The same, with a word of one or two letters counted as half. */
  const strength = new Map<string, number>();

  const unlisted: string[] = [];
  for (const word of words) {
    const languages = index.get(word);
    if (!languages) {
      unlisted.push(word);
      continue;
    }
    evidence.push({ languages, worth: 1 / languages.length, count: 1 });
    /* Half for a short word in Latin letters only: Russian is built from
       и, в, не and на, and there are four Cyrillic languages to mistake it
       for, not forty. */
    const heft = word.length <= 2 && word.charCodeAt(0) < 0x0370 ? 0.5 : 1;
    for (const language of languages) {
      found.set(language, (found.get(language) ?? 0) + 1);
      strength.set(language, (strength.get(language) ?? 0) + heft);
    }
  }

  /* Words no list has, spelled with a letter one language owns. */
  const listed = new Set(found.keys());
  for (const word of unlisted) {
    const own = OWN_LETTERS.find(([letters]) => [...word].some((char) => letters.includes(char)));
    if (!own || !listed.has(own[1])) continue;
    const language = own[1];
    evidence.push({ languages: [language], worth: 1, count: 1 });
    found.set(language, (found.get(language) ?? 0) + 1);
    strength.set(language, (strength.get(language) ?? 0) + 1);
  }

  /* Letters decide between languages the words already point at. A language
     no word was found in is not brought in by an accent. */
  const credited = new Map<string, number>();
  for (const char of text) {
    for (const [letters, languages] of LETTERS) {
      if (!letters.includes(char)) continue;
      const among = languages.filter(
        (language) => found.has(language) && (credited.get(language) ?? 0) < LETTER_CAP
      );
      if (among.length === 0) continue;
      const worth = 0.5 / languages.length;
      evidence.push({ languages: among, worth, count: 0.5 });
      for (const language of among) credited.set(language, (credited.get(language) ?? 0) + worth);
    }
  }

  const weight = new Map<string, number>();
  for (const { languages, worth } of evidence) {
    for (const language of languages) weight.set(language, (weight.get(language) ?? 0) + worth);
  }

  /* Most weight first; between equals, most words. */
  const ranked = [...weight.entries()].sort(
    (a, b) => b[1] - a[1] || (found.get(b[0]) ?? 0) - (found.get(a[0]) ?? 0)
  );
  if (ranked.length === 0) return null;

  const winner = ranked[0][0];
  const wordsFound = found.get(winner) ?? 0;

  if ((strength.get(winner) ?? 0) < MIN_EVIDENCE) return null;
  if (wordsFound / words.length < MIN_COVERAGE) return null;

  /* Against every other language, not only the next by weight: the nearest
     rival is the one that shares the most, and that one can weigh little. */
  for (const [rival] of ranked) {
    if (rival === winner) continue;
    let mine = 0;
    let theirs = 0;
    for (const { languages, count } of evidence) {
      const forWinner = languages.includes(winner);
      const forRival = languages.includes(rival);
      if (forWinner && !forRival) mine += count;
      if (forRival && !forWinner) theirs += count;
    }
    if (mine - theirs < MIN_LEAD) return null;
    if (theirs > mine * RIVAL_SHARE) return null;
  }

  return winner;
}

export type DetectOptions = {
  /**
   * Phrases to read past — the game's own title. It is in whatever language
   * the game was named in, which is not evidence about the review.
   */
  ignore?: readonly string[];
};

/**
 * The language a text is written in, as an ISO 639-1 code — or `null` when it
 * cannot honestly be told: too short, a name, a score, or a language this does
 * not know.
 */
export function detectLanguage(
  input: string | null | undefined,
  options: DetectOptions = {}
): string | null {
  if (!input) return null;
  const text = prose(input, options.ignore ?? []);
  const { scripts, words } = read(text);

  const count = (script: Script) => scripts[script] ?? 0;
  const heft = (script: Script) => count(script) * (LETTER_WEIGHT[script] ?? 1);

  let total = 0;
  let letters = 0;
  for (const script of Object.keys(scripts) as Script[]) {
    total += heft(script);
    letters += count(script);
  }
  if (letters < 2) return null;

  const most = (...of: Script[]) =>
    of.reduce((sum, script) => sum + heft(script), 0) / total >= 0.5;

  /*
   * Japanese and Chinese share Han, and are told apart by what else is there.
   * Hiragana is Japanese's grammar — a sentence that is nine tenths kanji
   * still has its は — so any of it is Japanese, *unless* the text also has
   * characters only Chinese writes and the hiragana is a sliver: that is
   * Chinese naming a Japanese title. Katakana alone is a name in Chinese and
   * a word in Japanese, so it takes two.
   */
  if (most('han', 'hiragana', 'katakana')) {
    const cjk = count('han') + count('hiragana') + count('katakana');
    const quoted = CHINESE_ONLY.test(text) && count('hiragana') / cjk < HIRAGANA_QUOTED;
    if (!quoted && (count('hiragana') >= 1 || count('katakana') >= 2)) return 'ja';
    return count('han') >= MIN_HAN ? 'zh' : null;
  }

  if (most('hangul')) return 'ko';
  if (most('thai')) return 'th';
  if (most('hebrew')) return 'he';
  if (most('greek')) return 'el';
  if (most('devanagari')) return 'hi';

  if (most('arabic')) {
    if (URDU.test(text)) return null;
    return PERSIAN.test(text) ? 'fa' : 'ar';
  }

  if (most('cyrillic')) return OTHER_CYRILLIC.test(text) ? null : byWords(text, words);
  if (most('latin')) return OTHER_LATIN.test(text) ? null : byWords(text, words);

  return null;
}

/**
 * What is stored beside a review: its language, or `null` — for a review nobody
 * could place, and for no review at all. A headline is read with the words
 * under it; it is the same person writing.
 *
 * `null` is "unknown", never "none": see `canRead`.
 */
export function reviewLanguage(
  review: string | null | undefined,
  headline?: string | null,
  options: DetectOptions = {}
): string | null {
  if (!review || review.trim().length === 0) return null;
  return detectLanguage(headline ? `${headline}\n${review}` : review, options);
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/**
 * Every language the detector can name, as it is called in English — the
 * interface's language — in the order a picker lists them: the app's own, then
 * roughly by how many people play games in each.
 */
export const LANGUAGES: readonly { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ar', name: 'Arabic' },
  { code: 'id', name: 'Indonesian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'nb', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'et', name: 'Estonian' },
  { code: 'cs', name: 'Czech' },
  { code: 'sk', name: 'Slovak' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'gl', name: 'Galician' },
  { code: 'hr', name: 'Croatian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'el', name: 'Greek' },
  { code: 'th', name: 'Thai' },
  { code: 'hi', name: 'Hindi' },
  { code: 'he', name: 'Hebrew' },
  { code: 'fa', name: 'Persian' },
];

const NAMES = new Map(LANGUAGES.map((language) => [language.code, language.name]));

/** Whether a code is one a review can be labelled with. */
export function isKnownLanguage(code: string | null | undefined): code is string {
  return !!code && NAMES.has(code);
}

export function languageName(code: string): string {
  return NAMES.get(code) ?? code.toUpperCase();
}

/** "English", "English and Spanish", "English, Spanish and French". */
export function languageList(codes: readonly string[]): string {
  const names = codes.map(languageName);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The same, for one line under a heading: up to three by name, and past that
 * the first two and how many more — "English, Spanish and 4 more".
 */
export function languageSummary(codes: readonly string[]): string {
  if (codes.length <= 3) return languageList(codes);
  const [first, second] = codes.map(languageName);
  return `${first}, ${second} and ${codes.length - 2} more`;
}

// ---------------------------------------------------------------------------
// The reader
// ---------------------------------------------------------------------------

/**
 * What a phone's language tag means for reading reviews, where that is not
 * simply itself.
 *
 * Codes ISO retired and Android still reports (`iw`, `in`); Norwegian's three
 * names for one written language; and the three where reading one is reading
 * the other — Malay and Indonesian, Bosnian and Croatian, and Serbian, whose
 * readers read it in both alphabets (a review in Latin letters is labelled
 * `hr`: nothing in the words says which side of a border it was typed on).
 */
const READS: Readonly<Record<string, readonly string[]>> = {
  iw: ['he'],
  in: ['id'],
  ms: ['id'],
  no: ['nb'],
  nn: ['nb'],
  bs: ['hr'],
  sr: ['sr', 'hr'],
};

/**
 * The languages in a list of locale tags, in their order, each once: `es-ES`,
 * `pt_BR` and `zh-Hans-CN` are `es`, `pt` and `zh`. Anything that is not a
 * language tag is skipped, and so is a language no review can be labelled with
 * — a filter on a label nothing carries would only ever hide.
 */
export function languagesOfLocales(locales: readonly unknown[]): string[] {
  const found: string[] = [];
  for (const locale of locales) {
    if (typeof locale !== 'string') continue;
    const primary = locale.trim().toLowerCase().split(/[-_]/)[0];
    if (!/^[a-z]{2,3}$/.test(primary)) continue;
    for (const code of READS[primary] ?? [primary]) {
      if (isKnownLanguage(code) && !found.includes(code)) found.push(code);
    }
  }
  return found;
}

/**
 * How somebody chose to be shown reviews.
 *
 * - `auto` — worked out: the app's language, the phone's, and the ones they
 *   write in.
 * - `chosen` — exactly these.
 * - `all` — nothing is left out for its language.
 */
export type ReadingChoice =
  { mode: 'auto' } | { mode: 'all' } | { mode: 'chosen'; languages: string[] };

export const DEFAULT_READING_CHOICE: ReadingChoice = { mode: 'auto' };

/** Whatever was stored, as a choice — and `auto` for anything that is not one. */
export function coerceReadingChoice(value: unknown): ReadingChoice {
  if (!value || typeof value !== 'object') return DEFAULT_READING_CHOICE;
  const stored = value as { mode?: unknown; languages?: unknown };

  if (stored.mode === 'all') return { mode: 'all' };
  if (stored.mode === 'chosen' && Array.isArray(stored.languages)) {
    const languages = stored.languages.filter(
      (code, index, all): code is string => isKnownLanguage(code) && all.indexOf(code) === index
    );
    /* Choosing nothing is not a way to see nothing; it is no choice. */
    return languages.length > 0 ? { mode: 'chosen', languages } : DEFAULT_READING_CHOICE;
  }
  return DEFAULT_READING_CHOICE;
}

/**
 * What `auto` comes to: the app's language first — the interface is in it, so
 * whoever is reading this reads it — then the phone's, then any they have
 * written a review in. Each once.
 */
export function automaticLanguages(
  device: readonly string[],
  written: readonly string[]
): string[] {
  return languagesOfLocales([APP_LANGUAGE, ...device, ...written]);
}

/**
 * The languages somebody is shown reviews in — or `null` for all of them.
 *
 * `null` is not an empty list: an empty list would show nothing, and there is
 * no state in which that is what somebody asked for.
 */
export function readingLanguages(
  choice: ReadingChoice,
  device: readonly string[],
  written: readonly string[]
): string[] | null {
  if (choice.mode === 'all') return null;
  if (choice.mode === 'chosen') return choice.languages;
  return automaticLanguages(device, written);
}

/**
 * Whether a review labelled `language` is one this reader is shown.
 *
 * **Unknown is readable.** A review with no label is shown to everybody: the
 * alternative hides every review written before labels existed, and every
 * one-word verdict after.
 */
export function canRead(
  language: string | null | undefined,
  reading: readonly string[] | null
): boolean {
  if (reading === null) return true;
  if (!language) return true;
  return reading.includes(language);
}
