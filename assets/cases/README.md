# Case & disc templates

The PNGs here are what the app draws for a physical game: the **case
templates** (`<key>_case.png`, one per platform) and the **disc templates**
(`<key>_disc.png`, and `game_cd.png` for every platform without one).

Most of the cases began as the front covers of the owner's template pack — a
folder per console, each with a `cover/` folder — of which the app uses **only
the front cover**, never a spine, a back, a 3D box or an example. They were
copied here under flat names because the pack's own paths hold spaces and
colons (`Genesis : Megadrive`, `PC Engine:TurboGrafx-16`), which Metro turns
into a URL in development and an Android resource name in a release build. The
pack itself is no longer in the repository; the table below records which file
each template was. Four cases — PS4, Switch 2, Wii U and 3DS — and the Xbox
pair are the owner's own files instead.

## The contract

A case template is the **front face** of the case:

- **opaque chrome** — border, band, platform branding
- **a see-through window** where the cover art goes: fully transparent, or the
  translucent plastic of a shell (PS4, Switch 2, Wii U, 3DS)

The artwork is drawn *underneath* the template and shows through that window.
The window must be genuinely see-through, not white — white will hide the
cover completely. A front with no window at all cannot be a template: the
pack's Fairchild Channel F front, three of its four Amstrad fronts and the
first Odyssey 2 front are opaque all over.

**Crop a template to its case.** A case drawn inside clear space cannot be
told from a window that runs to the edge, so its cover is drawn across the
clear space too and shows past the case. PS4's did, until its file was re-cut.

Each file has an entry in `CASE_TEMPLATES` (`src/constants/platform-cases.ts`):

```ts
templateSize: { width: 549, height: 688 },               // the PNG's real dimensions
coverArea:    { x: 0, y: 78, width: 549, height: 610 },  // the window, in those pixels
```

**Both come from a script, every time a file is replaced or added:**

```bash
node --import ./scripts/esm-register.mjs scripts/case-templates.mjs
```

It prints the size and window of every `*_case.png` and says which entries in
the table no longer agree with their file. The size is the PNG's own. The
window is the bounding box of everything the cover has to be behind — the
see-through regions, and any shading that fades into them — widened two pixels
wherever there is chrome for the cover to slide under. A file dropped in
without updating them is drawn stretched to the old size with the cover in the
old place — PS4 and PS5 were, for two months.

A template can be any shape (a SNES box lies on its side, a PlayStation jewel
case is wider than it is tall), and its window need not be a rectangle: the
cover is drawn underneath and the template's own pixels cut it.

## Cases

| File | Platform | Size | Cover window (x, y, w, h) | From |
|---|---|---|---|---|
| `ps5_case.png` | `ps5` — PlayStation 5 | 549×688 | 0, 78, 549, 610 | the owner's own file |
| `ps4_case.png` | `ps4` — PlayStation 4 | 476×671 | 0, 9, 467, 654 | the owner's own file |
| `ps3_case.png` | `ps3` — PlayStation 3 | 571×659 | 0, 67, 571, 592 | the owner's own file |
| `ps2_case.png` | `ps2` — PlayStation 2 | 486×680 | 0, 70, 486, 610 | the pack: `Sony/Playstation 2/cover/Playstation 2 cover - front.png` |
| `ps1_case.png` | `ps1` — PlayStation | 792×680 | 181, 0, 611, 680 | the pack: `Sony/Playstation 1/cover/Playstation 1 cover - front.png` |
| `psp_case.png` | `psp` — PlayStation Portable | 397×680 | 0, 34, 397, 646 | the pack: `Sony/Playstation Portable/cover/Playstation Portable cover - front.png` |
| `vita_case.png` | `vita` — PlayStation Vita | 534×680 | 0, 53, 534, 627 | the pack: `Sony/Playstation Vita/cover/Playstation Vita cover - front.png` |
| `xone_case.png` | `xbox` — Xbox | 516×730 | 0, 88, 516, 642 | the owner's own file |
| `xbox_case.png` | `xbox360` — Xbox 360 | 610×870 | 0, 104, 610, 766 | the owner's own file |
| `switch2_case.png` | `switch2` — Nintendo Switch 2 | 388×636 | 0, 91, 372, 532 | the owner's own file |
| `switch_case.png` | `switch` — Nintendo Switch | 421×680 | 0, 0, 421, 680 | the pack: `Nintendo/Switch/cover/switch cover - front.png` |
| `wiiu_case.png` | `wiiu` — Wii U | 523×732 | 0, 0, 510, 732 | the owner's own file |
| `wii_case.png` | `wii` — Wii | 486×680 | 0, 16, 486, 664 | the pack: `Nintendo/Wii/cover/Wii cover - front.png` |
| `gamecube_case.png` | `gamecube` — GameCube | 486×680 | 0, 43, 486, 637 | the pack: `Nintendo/Gamecube/cover/Gamecube cover - front.png` |
| `n64_case.png` | `n64` — Nintendo 64 | 680×497 | 0, 0, 558, 497 | the pack: `Nintendo/N64/cover/N64 cover - front.png` |
| `snes_case.png` | `snes` — Super Nintendo | 680×497 | 0, 21, 562, 398 | the pack: `Nintendo/SNES/cover/SNES US cover - front.png` |
| `nes_case.png` | `nes` — NES | 497×680 | 49, 47, 401, 342 | the pack: `Nintendo/NES/cover/NES cover - front.png` |
| `3ds_case.png` | `threeds` — Nintendo 3DS | 572×523 | 2, 13, 498, 497 | the owner's own file |
| `ds_case.png` | `ds` — Nintendo DS | 514×458 | 70, 0, 444, 458 | the pack: `Nintendo/DS/cover/DS cover - front.png` |
| `gba_case.png` | `gba` — Game Boy Advance | 700×700 | 144, 0, 556, 700 | the pack: `Nintendo/GBA/cover/GBA cover - front.png` |
| `gbc_case.png` | `gbc` — Game Boy Color | 700×700 | 144, 0, 556, 700 | the pack: `Nintendo/GBC/cover/GBC cover - front.png` |
| `gameboy_case.png` | `gameboy` — Game Boy | 700×700 | 144, 0, 556, 700 | the pack: `Nintendo/GB/cover/GB cover - front.png` |
| `virtualboy_case.png` | `virtualboy` — Virtual Boy | 513×458 | 0, 26, 513, 320 | the pack: `Nintendo/Virtual Boy/cover/Virtual Boy cover - front.png` |
| `pokemonmini_case.png` | `pokemonmini` — Pokémon mini | 700×700 | 0, 116, 700, 584 | the pack: `Nintendo/Pokemon Mini/cover/Pokemon Mini cover - front.png` |
| `dreamcast_case.png` | `dreamcast` — Dreamcast | 680×680 | 84, 0, 596, 680 | the pack: `Sega/Dreamcast/cover/Dreamcast cover - front.png` |
| `saturn_case.png` | `saturn` — Sega Saturn | 441×680 | 80, 0, 361, 680 | the pack: `Sega/Saturn/cover/Sega Saturn cover - front.png` |
| `genesis_case.png` | `genesis` — Sega Genesis | 484×680 | 93, 0, 391, 589 | the pack: `Sega/Genesis : Megadrive/cover/Genesis cover - front.png` |
| `segacd_case.png` | `segacd` — Sega CD | 481×680 | 78, 0, 403, 627 | the pack: `Sega/Sega CD : Mega CD/cover/Sega CD cover - front.png` |
| `sega32x_case.png` | `sega32x` — Sega 32X | 484×680 | 92, 0, 392, 680 | the pack: `Sega/Sega 32X/cover/Sega 32X cover - front.png` |
| `mastersystem_case.png` | `mastersystem` — Master System | 484×680 | 41, 134, 403, 467 | the pack: `Sega/Master System/cover/Master System cover - front.png` |
| `gamegear_case.png` | `gamegear` — Game Gear | 496×680 | 88, 0, 408, 615 | the pack: `Sega/Game Gear/cover/Game Gear cover -  front.png` |
| `sg1000_case.png` | `sg1000` — SG-1000 | 492×680 | 70, 136, 350, 453 | the pack: `Sega/SG-1000/cover/SG-1000 cover - front.png` |
| `atari2600_case.png` | `atari2600` — Atari 2600 | 497×680 | 28, 314, 441, 328 | the pack: `Atari/Atari 2600/cover/Atari 2600 cover - front.png` |
| `atari5200_case.png` | `atari5200` — Atari 5200 | 497×680 | 41, 315, 414, 326 | the pack: `Atari/Atari 5200/cover/Atari 5200 cover - front.png` |
| `atari7800_case.png` | `atari7800` — Atari 7800 | 497×680 | 41, 166, 415, 429 | the pack: `Atari/Atari 7800/cover/Atari 7800 cover - front.png` |
| `jaguar_case.png` | `jaguar` — Atari Jaguar | 496×680 | 40, 0, 456, 635 | the pack: `Atari/Atari Jaguar:CD/cover/Atari Jaguar cover - front.png` |
| `jaguarcd_case.png` | `jaguarcd` — Atari Jaguar CD | 486×680 | 0, 0, 486, 637 | the pack: `Atari/Atari Jaguar:CD/cover/Atari Jaguar CD cover - front.png` |
| `lynx_case.png` | `lynx` — Atari Lynx | 554×680 | 29, 22, 495, 560 | the pack: `Atari/Atari Lynx/cover/Atari Lynx cover - front.png` |
| `neogeo_case.png` | `neogeo` — Neo Geo | 496×680 | 0, 0, 496, 680 | the pack: `Other/Neo Geo/cover/Neo Geo cover - front - 1p.png` |
| `ngp_case.png` | `ngp` — Neo Geo Pocket | 510×458 | 0, 0, 510, 417 | the pack: `Other/Neo Geo Pocket : Color/Neo Geo Pocket/cover/Neo Geo Pocket cover - front.png` |
| `ngpc_case.png` | `ngpc` — Neo Geo Pocket Color | 599×700 | 0, 0, 599, 644 | the pack: `Other/Neo Geo Pocket : Color/Neo Geo Pocket Color/cover/Neo Geo Pocket Color cover - front.png` |
| `pcengine_case.png` | `pcengine` — TurboGrafx-16 | 517×680 | 46, 131, 400, 399 | the pack: `Other/PC Engine:TurboGrafx-16/cover/TG16 cover - front 1.png` |
| `pcfx_case.png` | `pcfx` — PC-FX | 680×680 | 0, 0, 680, 680 | the pack: `Other/PC FX/cover/PC FX cover - front.png` |
| `threedo_case.png` | `threedo` — 3DO | 370×700 | 0, 29, 370, 671 | the pack: `Other/3DO/cover/3DO cover - front - US.png` |
| `wonderswan_case.png` | `wonderswan` — WonderSwan | 497×680 | 0, 25, 497, 655 | the pack: `Other/Wonderswan : Color/cover/Wonderswan cover - front.png` |
| `wonderswancolor_case.png` | `wonderswancolor` — WonderSwan Color | 497×680 | 0, 94, 497, 586 | the pack: `Other/Wonderswan : Color/cover/Wonderswan Color cover - front.png` |
| `colecovision_case.png` | `colecovision` — ColecoVision | 498×680 | 28, 89, 444, 393 | the pack: `Other/Colecovision/cover/Colecovision cover - front 1.png` |
| `intellivision_case.png` | `intellivision` — Intellivision | 497×680 | 41, 187, 415, 397 | the pack: `Other/Intellivision/cover/Intellivision cover - front.png` |
| `vectrex_case.png` | `vectrex` — Vectrex | 496×680 | 121, 268, 253, 348 | the pack: `Other/Vectrex/cover/Vectrex cover - front.png` |
| `odyssey2_case.png` | `odyssey2` — Odyssey 2 | 495×680 | 0, 0, 495, 680 | the pack: `Other/Magnavox Odyssey 2 : VideoPac/cover/Magnavox Odyssey 2 cover - front 2.png` |
| `arcadia_case.png` | `arcadia` — Arcadia 2001 | 496×680 | 32, 212, 432, 432 | the pack: `Other/Arcadia 2001/cover/Arcadia 2001 cover - front.png` |
| `vc4000_case.png` | `vc4000` — VC 4000 | 514×680 | 0, 228, 514, 452 | the pack: `Other/Interton VC 4000/cover/Interton VC 4000 cover - front.png` |
| `supervision_case.png` | `supervision` — Supervision | 535×700 | 64, 249, 402, 350 | the pack: `Other/Supervision/cover/Supervision cover - front.png` |
| `megaduck_case.png` | `megaduck` — Mega Duck | 680×533 | 146, 0, 534, 533 | the pack: `Other/Mega Duck : Cougar Boy/cover/Mega Duck cover - front.png` |
| `arduboy_case.png` | `arduboy` — Arduboy | 497×680 | 0, 0, 497, 680 | the pack: `Other/Arduboy/cover/Arduboy cover - front.png` |
| `c64_case.png` | `c64` — Commodore 64 | 483×680 | 0, 0, 483, 680 | the pack: `Other/Commodore 64/cover/Commodore 64 cover - front 1.png` |
| `amstradcpc_case.png` | `amstradcpc` — Amstrad CPC | 439×680 | 0, 0, 439, 680 | the pack: `Other/Amstrad CPC/cover/Amstrad CPC cover - front2.png` |
| `apple2_case.png` | `apple2` — Apple II | 496×680 | 0, 0, 496, 680 | the pack: `Other/Apple 2/cover/Apple 2 cover - front.png` |

`xbox_case.png` is the Xbox 360's artwork, whatever its name says, and
`xone_case.png` — the Xbox One's — is the `xbox` family's.

## Discs

A physical copy's disc — in the binder, and sliding out from under its case —
is `<CdDisc>`: the game's art in a circle, the hub in the colour behind, and a
disc template over both. Same contract as a case: the label is see-through.

| File | Platform | Size | Centre | Rim, art, hub radius |
|---|---|---|---|---|
| `ps1_disc.png` | `ps1` — PlayStation | 600×600 | 298.5, 300.5 | 298.5, 293, 40 |
| `ps2_disc.png` | `ps2` — PlayStation 2 | 600×600 | 300, 300 | 294, 291, 62 |
| `wii_disc.png` | `wii` — Wii | 600×600 | 300, 300 | 298, 291, 98 |
| `wiiu_disc.png` | `wiiu` — Wii U | 600×600 | 300, 300.5 | 294.5, 281, 63 |
| `game_cd.png` | every other platform | 890×897 | 450.5, 448 | 427, 421, 156 |

The figures are in `src/constants/cd-template.ts`, measured from each file:
the centre from the bounding box of what is drawn; the rim where the disc
ends; the art radius a few pixels inside the rim's opaque edge, so the art
meets the rim and never shows past it; the hub radius the outside of the clear
hub ring (or, on PlayStation's solid black hub, the hole in it). To give
another platform its own disc, drop `<key>_disc.png` here and add its entry to
`PLATFORM_DISCS` with those five numbers.

`disc.png` is a different object: the soundtrack screen's record
(`DISC_TEMPLATE`, `<GameDisc>`).

## What has no case

- **PC**, by the owner's earlier decision. PC leads the platform order
  *because* it shows the bare cover, so giving it a box would put every
  multiplatform game in one.
- **The original Xbox**, which never had one.
- **Fairchild Channel F** — the pack's only front for it has no window.

## Adding a platform

1. Drop its front as `<key>_case.png` here, cropped to the case.
2. Run the script. Add the platform's key to `CasePlatformKey` and
   `CASE_PLATFORMS` in `src/constants/platform-cases.ts`, and an entry to
   `CASE_TEMPLATES` with the `templateSize` and `coverArea` it printed.
3. If the platform is new to the app as well, add it to `PlatformKey`,
   `PLATFORMS`, `PLATFORM_PRIORITY` and `PATTERNS` (so provider platform
   strings — "PlayStation 5", "PS5", … — resolve to it), and to
   `PLATFORM_MEDIUM` in `platform-media.ts`. Then sweep IGDB's real platform
   names through the patterns: an ordering mistake there is silent.
