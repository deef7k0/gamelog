# Case & disc templates

The PNGs here are **generated placeholders**. Replace them with real artwork —
nothing in the components needs to change, provided you keep the contract below.

## The contract

A case template is the **front face** of the case:

- **opaque chrome** — border, top band, platform branding
- **a fully transparent rectangle** where the cover art goes

The artwork is drawn *underneath* the template and shows through that window.
The window must be genuinely transparent (alpha 0), not white — white will hide
the cover completely.

For each file you replace, check the matching entry in
`src/constants/platform-cases.ts`:

```ts
templateSize: { width: 540, height: 680 },      // the PNG's real dimensions
coverArea:    { x: 16, y: 52, width: 508, height: 612 },  // the window, in those pixels
```

If your replacement has different dimensions or a differently-placed window,
update those two fields and you are done. Everything else — scaling, the spine,
shadow, gloss — is derived from them.

## Current files

| File | Size | Cover window (x, y, w, h) |
|---|---|---|
| `ps5_case.png` | 540×680 | 16, 58, 508, 606 |
| `ps4_case.png` | 540×680 | 16, 52, 508, 612 |
| `xbox_case.png` | 540×680 | 14, 62, 512, 604 |
| `switch_case.png` | 540×680 | 14, 46, 512, 620 |
| `pc_case.png` | 540×680 | 14, 54, 512, 612 |
| `disc.png` | 512×512 | annulus r=78..248, centred |

540×680 is a 0.794 ratio, matching a real 135×170mm game case.

## A note on print wraps

Templates found online are usually **print wraps** — front, spine and back laid
out flat, often with ESRB blocks and barcodes baked in. Those are the wrong
geometry here: this system renders the front face only and generates the spine
itself from the game title and platform.

Crop a wrap down to just the front face before using it.

## Adding a platform

1. Drop `<key>_case.png` in this folder.
2. Add an entry to `CASE_TEMPLATES` in `src/constants/platform-cases.ts`.
3. Add the key to `PLATFORM_PRIORITY`.
4. Add a matching pattern to `PATTERNS` so provider platform strings
   ("PlayStation 5", "PS5", …) resolve to it.
