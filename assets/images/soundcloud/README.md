# SoundCloud's marks

SoundCloud's own logo files, downloaded from
<https://developers.soundcloud.com/docs/api/buttons-logos> and not edited:

| File | Size | Published as |
| --- | --- | --- |
| `logo-big-white.png` | 200×24 | `logo_big_white-….png` |
| `powered-by-large-white.png` | 320×27 | `powered_by_large_white-….png` |

They are the white marks, for this app's dark pages, and `<SoundCloudMark>`
(`src/components/player/soundcloud-mark.tsx`) draws each at half its pixel size.

**Do not tint, recolour, crop, redraw or re-export them.** SoundCloud's API
terms ask that wherever one of its tracks is shown or played the app credit
SoundCloud with one of its logos, unmodified. To change a mark, download
another of SoundCloud's own files from that page.
