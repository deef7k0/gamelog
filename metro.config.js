const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Modules this app never runs, resolved to an empty module so they are not
 * bundled.
 *
 * **`@expo-google-fonts/material-symbols`** — a 967 KB font. `expo-router`
 * depends on `expo-symbols` for its native tabs, and `expo-symbols` imports the
 * regular weight of Google's Material Symbols at module scope, so the font
 * shipped in every build. It is read only inside `getFont()`, when a
 * `<SymbolView>` renders on Android — and nothing here renders one: the app's
 * tabs are its own (`<AppTabBar>`), its icons are Ionicons. If a `<SymbolView>`
 * is ever added, delete this rule.
 */
const EMPTY = /^@expo-google-fonts\/material-symbols(\/|$)/;

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (EMPTY.test(moduleName)) return { type: 'empty' };
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
