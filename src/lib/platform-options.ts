import type { SelectOption } from '@/components/ui/select-field';
import { PLATFORMS, platformKeysFor } from '@/constants/platform-cases';
import { PLATFORM_MEDIUM } from '@/constants/platform-media';

/**
 * The platforms a game can honestly have been played on — or owned on — as
 * choices for a `<SelectField>`.
 *
 * Sourced from the game's own platform list, so the choices are the release's
 * and not a global menu. The stored value is the short form ("PS5") — it is
 * what the case's printed back and a feed row have room for — while the sheet
 * shows the full name, which is what a person picking one needs to read.
 *
 * A value saved before a field was constrained is kept and offered as-is.
 * Dropping it would rewrite someone's own record to make the control look tidy,
 * which is the one outcome worse than the typo the constraint was built to
 * prevent.
 *
 * Lifted out of the review form, which built this inline, once the progress
 * sheet, playthroughs, copies and release submissions all needed the same list:
 * five copies of one rule is five chances for "PS5" to be spelt two ways.
 */
export function platformOptionsFor(
  gamePlatforms: string[] | null | undefined,
  saved: string | null | undefined,
  foreignTint: string,
  { physicalOnly = false }: { physicalOnly?: boolean } = {}
): SelectOption[] {
  const keys = platformKeysFor(gamePlatforms).filter(
    /* Nobody owns an iOS game on a shelf. Offering digital-only platforms on a
       form about a physical copy would be a choice that describes nothing. */
    (key) => !physicalOnly || PLATFORM_MEDIUM[key] !== 'digital'
  );

  const options: SelectOption[] = keys.map((key) => ({
    value: PLATFORMS[key].short,
    label: PLATFORMS[key].label,
    icon: PLATFORMS[key].icon,
    tint: PLATFORMS[key].accent,
  }));

  const kept = saved?.trim();
  if (kept && !options.some((option) => option.value === kept)) {
    options.push({
      value: kept,
      label: kept,
      icon: 'game-controller',
      tint: foreignTint,
      foreign: true,
    });
  }

  return options;
}
