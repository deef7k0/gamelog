# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Recorded as `adaptive` because GameLog ships to **both** iOS and Android and must
honour each OS's affordances — back gesture, safe areas, share sheet, modal
presentation, haptics. It does **not** license per-OS visual branching. The
confirmed decision is one shared custom design language across both platforms:
no Cupertino-on-iOS / Material-on-Android split. Native reference guidance
applies to behaviour, not to look.

## Users

People who play games and want a record of it — the same person who keeps a
Letterboxd. They open GameLog after finishing something (or partway through a
long playthrough), to log what they played, put a score and a written opinion on
it, and to see what the people they follow are playing.

This is built for real use, not as a coursework demo that happens to run. The
semester is the occasion; the product is meant to actually work for that person.

## Product Purpose

Letterboxd for videogames: track what you play, rate and review it, and follow
other people's playing.

Success is someone coming back to write about a second game — the app has to be
worth the effort of an opinion, not just a checkbox. A logging tool that only
collects statuses has failed even if every status is correct.

## Positioning

Three things carry the product. Future work must not trade any of them away:

1. **Linked gaming accounts.** A real Steam account imports its library,
   achievements, inventory, badges and friends. Steam is one implementation of a
   generic provider contract, not a special case — adding Xbox/PlayStation/Epic/
   GOG is a registration, not a rewrite, and no screen gains a conditional.
2. **Serious long-form reviews.** Reviews are 0–100 scored, magazine-shaped
   pieces with verdict bands, plus optional advanced metrics across 14
   categories. Criticism, not five stars.
3. **The physical shelf feel.** Box art everywhere, and a rendered game case on a
   game's own page, so opening a game feels like picking something off a shelf.

The diary (dated per-game notes) is a real feature but was explicitly *not*
named as a differentiator — it may be reshaped where the three above may not.

## Operating Context

- A phone, in the hands of someone who has just stopped playing — often on a
  console or PC across the room, not on the device they are logging from.
- Writing a real review is a sit-down task; logging a status is a ten-second one.
  Both live in the same app and neither should be made to feel like the other.
- Cover art is the primary content on nearly every screen. The interface is a
  frame around other people's artwork.
- Steam data arrives by background sync with per-section TTLs, not on demand;
  a large library takes several passes to fill in.

## Capabilities and Constraints

**Confirmed functionality.** Auth; IGDB game search; game detail with hero art,
case, synopsis, screenshots, franchise, studio and cast; logging with status,
0–100 score, completion %, platinum, hours, played-on; per-game achievements;
profiles with follows, friends and walls; feed; posts, articles, likes and
threaded comments; collections, ranked lists, tier lists, favourites, wishlist;
news, trailers, releases, an IGDB popularity chart, events and soundtracks;
linked Steam accounts; per-game diary.

**Hard technical constraints.**

- **Expo SDK 57 / React Native 0.86 / React 19.2**, run through Expo Go in
  development. Push notifications are unavailable in Expo Go (removed in SDK 53).
- **IGDB is the only catalogue.** Everything a user can add comes from IGDB, via
  a Supabase Edge Function that holds the Twitch secret. Steam/RAWG/itch.io code
  survives only to resolve ids logged before that cutover.
- **Row Level Security is the only authorization.** The anon key ships in the
  bundle. Any new table ships its policies in the same migration.
- **Secrets cannot ship in the bundle.** `EXPO_PUBLIC_*` is inlined at build time
  and an APK can be unzipped. The Twitch and Steam Web API keys live only as
  Edge Function secrets.
- **`logs.rating` is the only score anything reads.** A reviewer may score by
  category instead, but the client writes the mean into `rating` at the same
  time, so feeds, averages and stats never need to know how it was entered.
- **The repository path contains a space** (`claude code app/`). Fine for Expo
  Go; historically breaks Android Gradle builds — which the store-release goal
  below now requires. Renaming that folder is a prerequisite, not a nicety.

**What the APIs genuinely do not provide.** Recorded so they are not
re-attempted, and so nothing fabricates them:

- IGDB has no achievement data at all, and no cast, credits or actor data.
- Steam exposes no purchase dates and no badge names or icons.
- PlayStation has no public trophy API; `logs.platinum` is self-reported.
- No pricing API is referenced anywhere. Inventory carries `market_hash_name`
  (the join key every price service uses) and nothing else.

**Open decisions.**

- **Headed for a real App Store / Play Store release.** Store icons, screenshots,
  a privacy policy, account deletion and a native build therefore become real
  requirements rather than optional polish. None of them exist yet.
- No Steam Web API key has been obtained, so the Steam sync is inert until one is.
- Android package id is `com.nomicoprod.gamelog`; no iOS bundle id is set.

## Brand Commitments

- Name: **GameLog**. Slug/scheme `gamelog`.
- Letterboxd is the acknowledged reference product for structure and tone.
- The user has pinned one binding visual constraint: the near-black, monochrome
  dark treatment from the supplied reference screenshots, applied across the
  whole app.
- Real assets on hand: platform case art (`assets/cases/` — PC, PS4, PS5, Switch,
  Xbox, disc) and app icons (`assets/images/`, `assets/expo.icon/`).

## Evidence on Hand

- **Real:** IGDB's live catalogue (covers, artwork, screenshots, franchises,
  studios, characters, popularity); Steam's Web API for a linked account's own
  data; RSS from real gaming outlets; the case art and icons above.
- **Absent — must never be fabricated:** there are no users, reviews,
  testimonials, customer names, press quotes, benchmarks, ratings counts,
  download numbers or partnerships. Every social surface is empty until a real
  person fills it, and empty states must say so rather than ship placeholder
  activity.
- No pricing, licensing or deployment claims are true today.

## Product Principles

1. **One catalogue, one identity.** A game has exactly one cover, one year and
   one id everywhere in the app. Anything that would reintroduce the same title
   twice under two sources is a regression, whatever it buys.
2. **Never fabricate what a provider does not have.** When an API lacks a fact,
   hide the feature and say why — a sort that silently substitutes a different
   field, or a trophy count that is really a guess, is worse than its absence.
3. **Criticism over stars.** The number summarises the writing; it does not
   replace it. Anything that makes a score easier to give than an opinion is
   pushing the product the wrong way.
4. **The game page is a shelf; everything else is a feed.** The rendered case
   belongs on a game's own dedicated pages and nowhere else. Social and list
   surfaces stay flat and fast — diluting the case everywhere destroys the one
   moment that makes the app feel physical.
5. **A linked account is a provider, not a special case.** Every capability the
   UI offers is read from the provider's declared capabilities, so a new platform
   is a registration and never a conditional inside a screen.

## Accessibility & Inclusion

No formal standard has been set for this project. Current practice, which future
work should hold rather than regress: every control carries an
`accessibilityRole`, `accessibilityState` and a label where its glyph is not
self-describing; motion respects the reduced-motion setting; text colour pairs
are chosen for contrast on the near-black surfaces rather than assumed.
