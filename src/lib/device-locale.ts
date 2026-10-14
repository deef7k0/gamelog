import { I18nManager, Platform, Settings } from 'react-native';

/**
 * The languages this phone is set to, most preferred first, as locale tags
 * ("es-ES", "pt_BR") — whatever each platform will say without being asked
 * through a native module of its own.
 *
 * ## Why not `expo-localization`
 *
 * It is the tidy answer and it is a native module: linked into every build
 * whether or not this is the only caller (CLAUDE.md § APK size), absent from a
 * development build made before it was added, and — like every release-only
 * change — unproven until it has run on a phone. Three places already know:
 *
 * - **iOS** keeps the ordered list the person chose in Settings under
 *   `AppleLanguages`, and React Native's own `Settings` reads it.
 * - **Android and iOS** report the one locale the app is running in through
 *   `I18nManager` (`es_ES`). Android has no ordered list short of a module, so
 *   there this is the first language only — which is why a reader can add the
 *   rest by hand in Settings.
 * - **Hermes** has `Intl`, and its default locale is the same answer by a
 *   second route; the browser has `navigator.languages`.
 *
 * Every source is asked inside a `try`: a phone that will not say is a phone
 * set to nothing in particular, and the reader still reads the interface's
 * language (`automaticLanguages`).
 *
 * The tags are returned raw. `languagesOfLocales` (`lib/language`) turns them
 * into the languages a review can be labelled with, and is the tested half.
 */
export function deviceLocales(): string[] {
  const found: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === 'string' && value) found.push(value);
  };

  if (Platform.OS === 'ios') {
    try {
      /* `Settings` is iOS's; react-native-web has no such export. */
      const preferred: unknown = Settings?.get?.('AppleLanguages');
      if (Array.isArray(preferred)) preferred.forEach(add);
    } catch {
      /* Not available in this runtime; the next source will do. */
    }
  }

  try {
    add(I18nManager.getConstants().localeIdentifier);
  } catch {
    /* As above. */
  }

  try {
    add(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    /* An engine without `Intl`. */
  }

  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const preferred: unknown = navigator.languages;
    if (Array.isArray(preferred)) preferred.forEach(add);
    add(navigator.language);
  }

  return found;
}
